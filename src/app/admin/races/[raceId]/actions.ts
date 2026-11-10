"use server";

import { revalidatePath } from "next/cache";
import { isSpecialRuleAllowed } from "../../_components/labels";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchIbuResults, fetchIbuStartList, fetchIbuStartNations } from "@/lib/admin/ibuResults";
import { matchStartList, matchStartNations, saveStartList, saveStartNations } from "@/lib/admin/startListImport";
import { placeGeneralStartList, type OpeningRace } from "@/lib/admin/startListOpening";
import { RELAY_FORMATS } from "@/lib/raceFormats";
import { notifyGuestResults, notifyRaceResults } from "@/lib/notifications/jobs";
import { redirect } from "next/navigation";
import {
  deleteRace,
  rescorePursuitAfterSprint,
  resetRaceResults,
  saveRaceResults,
  scoreRace,
  type ResultEntryInput,
} from "@/lib/admin/raceResults";
import { adminFormAction } from "@/lib/admin/formAction";

export interface SubmitResultsState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitResults(
  raceId: string,
  entries: ResultEntryInput[]
): Promise<SubmitResultsState> {
  await requireAdmin();
  const admin = createAdminClient();

  try {
    await saveRaceResults(admin, raceId, entries);
    const summary = await scoreRace(admin, raceId);
    const pursuitRescored = await rescorePursuitAfterSprint(admin, raceId);
    const massStartNote = await tryMassStartListAfter(admin, raceId);
    // Les points sont enregistrés même si la notification échoue (Firebase pas branché…).
    const pushNote = await notifyRaceResults(admin, raceId).catch(
      (error) => ` Notification non envoyée : ${error instanceof Error ? error.message : "erreur inconnue"}.`
    );
    // Invités « e-mail seulement » : leur score les attend, e-mail avec code privé (migration 0045).
    const guestNote = await notifyGuestResults(admin, raceId).catch(
      (error) => ` E-mail des invités non envoyé : ${error instanceof Error ? error.message : "erreur inconnue"}.`
    );
    revalidatePath("/admin", "layout");
    return {
      status: "success",
      message:
        `Résultats enregistrés, ${summary.scoredPredictions} pronostic(s) noté(s), séries 10/10 recalculées.` +
        (pursuitRescored ? " Poursuite de l'étape renotée avec ses nouvelles cotes." : "") +
        massStartNote +
        pushNote +
        guestNote,
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

/**
 * Après la saisie d'une course individuelle, tente de récupérer la liste de départ IBU de la mass
 * start suivante de l'étape (même sexe), si elle n'en a pas encore. Sans liste publiée, rien ne
 * change : le bouton de la page de la mass start reste disponible.
 */
async function tryMassStartListAfter(admin: ReturnType<typeof createAdminClient>, raceId: string): Promise<string> {
  const { data: race } = await admin.from("races").select("stage_id, sex, format, locks_at").eq("id", raceId).single();
  if (!race?.sex || race.format === "mass_start" || race.format.startsWith("relais_")) return "";
  const { data: massStart } = await admin
    .from("races")
    .select("id")
    .eq("stage_id", race.stage_id)
    .eq("format", "mass_start")
    .eq("sex", race.sex)
    .gt("locks_at", race.locks_at)
    .order("locks_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!massStart) return "";
  const { count } = await admin.from("race_start_lists").select("athlete_id", { count: "exact", head: true }).eq("race_id", massStart.id);
  if ((count ?? 0) > 0) return "";
  const outcome = await importIbuStartList(admin, massStart.id);
  return outcome.ok
    ? ` Mass start : ${outcome.message}`
    : " Mass start : liste de départ pas encore publiée par l'IBU, réessaie depuis la page de la mass start.";
}

export interface IbuImportState {
  ok: boolean;
  message: string;
  csv?: string;
  warnings: string[];
}

/** Classement officiel IBU de la course, au format CSV, pour pré-remplir le formulaire (rien n'est enregistré). */
export async function loadIbuResults(raceId: string, forcedIbuRaceId?: string): Promise<IbuImportState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: race } = await admin
    .from("races")
    .select("format, sex, locks_at, stages(location, starts_on, ends_on, seasons(label))")
    .eq("id", raceId)
    .single();
  if (!race) return { ok: false, message: "Course introuvable.", warnings: [] };

  const stage = race.stages as any;
  try {
    const result = await fetchIbuResults({
      seasonLabel: stage.seasons?.label ?? "",
      stage,
      race,
      mode: ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"].includes(race.format) ? "nation" : "athlete",
      forcedRaceId: forcedIbuRaceId,
    });
    return { ok: true, message: `Résultats IBU : ${result.description} (${result.raceId}).`, csv: result.csv, warnings: result.warnings };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erreur IBU inconnue.", warnings: [] };
  }
}

export interface StartListImportState {
  ok: boolean;
  message: string;
  unmatched: string[];
}

/**
 * Liste de départ officielle IBU (toutes les courses ; relais : les nations engagées) : enregistrée
 * directement, elle remplace la liste provisoire du général. La course n'affiche ensuite que ces
 * biathlètes (ou nations), avec les cotes déjà validées. Ré-exécutable.
 */
export async function loadIbuStartList(raceId: string, forcedIbuRaceId?: string): Promise<StartListImportState> {
  await requireAdmin();
  return importIbuStartList(createAdminClient(), raceId, forcedIbuRaceId);
}

async function importIbuStartList(admin: ReturnType<typeof createAdminClient>, raceId: string, forcedIbuRaceId?: string): Promise<StartListImportState> {
  const { data: race } = await admin
    .from("races")
    .select("format, sex, locks_at, stages(season_id, location, starts_on, ends_on, seasons(label))")
    .eq("id", raceId)
    .single();
  if (!race) return { ok: false, message: "Course introuvable.", unmatched: [] };
  const stage = race.stages as any;

  if (RELAY_FORMATS.includes(race.format)) {
    try {
      const ibu = await fetchIbuStartNations({ seasonLabel: stage.seasons?.label ?? "", stage, race, forcedRaceId: forcedIbuRaceId });
      const { data: odds } = await admin
        .from("odds")
        .select("nation_code")
        .eq("season_id", stage.season_id)
        .eq("format", race.format)
        .is("valid_until", null);
      const matched = matchStartNations(ibu.nations, (odds ?? []).map((o: any) => o.nation_code).filter(Boolean));
      if (matched.rows.length === 0) {
        return { ok: false, message: `Aucune nation de la liste IBU (${ibu.nations.length}) n'a de cote pour ce relais : rien enregistré.`, unmatched: matched.unmatched };
      }
      await saveStartNations(admin, raceId, matched.rows);
      revalidatePath("/admin", "layout");
      return {
        ok: true,
        message: `Liste de départ IBU enregistrée : ${ibu.description} (${ibu.raceId}), ${matched.rows.length} nation(s) sur ${ibu.nations.length} avec leur cote.`,
        unmatched: matched.unmatched,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Erreur IBU inconnue.", unmatched: [] };
    }
  }

  try {
    const ibu = await fetchIbuStartList({ seasonLabel: stage.seasons?.label ?? "", stage, race, forcedRaceId: forcedIbuRaceId });
    const { data: odds } = await admin
      .from("odds")
      .select("athlete_id, athletes(first_name, last_name, nation_code, sex)")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null);
    const candidates = (odds ?? [])
      .filter((o: any) => o.athlete_id && (!race.sex || o.athletes?.sex === race.sex))
      .map((o: any) => ({
        id: o.athlete_id as string,
        firstName: o.athletes?.first_name ?? "",
        lastName: o.athletes?.last_name ?? "",
        nationCode: o.athletes?.nation_code ?? "",
      }));
    const matched = matchStartList(ibu.entries, candidates);
    if (matched.rows.length === 0) {
      return { ok: false, message: `Aucun biathlète de la liste IBU (${ibu.entries.length}) n'a de cote pour ce format : rien enregistré.`, unmatched: matched.unmatched };
    }
    await saveStartList(admin, raceId, matched.rows);
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: `Liste de départ IBU enregistrée : ${ibu.description} (${ibu.raceId}), ${matched.rows.length} biathlète(s) sur ${ibu.entries.length} avec leur cote.`,
      unmatched: matched.unmatched,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erreur IBU inconnue.", unmatched: [] };
  }
}

export const clearStartList = adminFormAction(async (formData: FormData) => {
  await requireAdmin();
  const admin = createAdminClient();
  const raceId = String(formData.get("race_id"));
  await saveStartList(admin, raceId, []);
  await saveStartNations(admin, raceId, []);
  revalidatePath("/admin", "layout");
});

/**
 * Sprint, individuel, relais : (re)place la liste provisoire du lundi 17 h, d'après le classement
 * général IBU (60 premiers, ou nations du général du relais). Remplace la liste enregistrée, même
 * officielle. La tâche planifiée le fait toute seule à l'ouverture ; ce bouton sert à la refaire.
 */
export async function loadGeneralStartList(raceId: string): Promise<StartListImportState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: race } = await admin
    .from("races")
    .select("id, format, sex, locks_at, stages!inner(season_id, starts_on, location)")
    .eq("id", raceId)
    .single();
  if (!race) return { ok: false, message: "Course introuvable.", unmatched: [] };
  try {
    const report = await placeGeneralStartList(admin, race as unknown as OpeningRace);
    revalidatePath("/admin", "layout");
    return { ok: true, message: `Liste provisoire enregistrée : ${report}.`, unmatched: [] };
  } catch (err) {
    return { ok: false, message: `Liste provisoire non enregistrée : ${err instanceof Error ? err.message : "erreur IBU inconnue"}.`, unmatched: [] };
  }
}

/** Modifie format, sexe, heure de départ (UTC) et course spéciale. */
export const updateRace = adminFormAction(async (formData: FormData) => {
  await requireAdmin();
  const raceId = String(formData.get("race_id"));
  const format = String(formData.get("format"));
  const sex = String(formData.get("sex"));
  const specialRule = String(formData.get("special_rule"));
  if (!isSpecialRuleAllowed(format, specialRule)) throw new Error("Brouillard : seulement sur un sprint ou une individuelle ; Fête nationale : seulement sur une course individuelle.");
  const admin = createAdminClient();
  if (specialRule !== "") {
    const { data: race } = await admin.from("races").select("stages(coefficient)").eq("id", raceId).single();
    if ((race?.stages as unknown as { coefficient: number } | null)?.coefficient === 2) throw new Error("Pas de course malus ni de Fête nationale sur les Mondiaux / JO (étape à coefficient 2).");
  }
  // relais_h/f portent le sexe dans le format, les relais mixtes n'en ont pas.
  const sexless = format.startsWith("relais_");

  const { error } = await admin
    .from("races")
    .update({
      format,
      sex: sex === "" || sexless ? null : sex,
      locks_at: `${String(formData.get("locks_at"))}:00Z`,
      special_rule: specialRule === "" ? null : specialRule,
    })
    .eq("id", raceId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
});

/** « L'avis de Biathlonpronos » de la course ; un texte vide masque la rubrique sur la page course. */
export const updateRaceOpinion = adminFormAction(async (formData: FormData) => {
  await requireAdmin();
  const raceId = String(formData.get("race_id"));
  const opinion = String(formData.get("opinion") ?? "").trim();

  const { error } = await createAdminClient()
    .from("races")
    .update({ opinion: opinion === "" ? null : opinion })
    .eq("id", raceId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
});

export const resetResults = adminFormAction(async (formData: FormData) => {
  await requireAdmin();
  const raceId = String(formData.get("race_id"));
  const admin = createAdminClient();
  await resetRaceResults(admin, raceId);
  await rescorePursuitAfterSprint(admin, raceId);
  revalidatePath("/admin", "layout");
});

export const removeRace = adminFormAction(async (formData: FormData) => {
  await requireAdmin();
  await deleteRace(createAdminClient(), String(formData.get("race_id")));
  revalidatePath("/admin", "layout");
  if (formData.get("redirect") === "1") redirect("/admin");
});
