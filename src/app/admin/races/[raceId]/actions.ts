"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchIbuResults } from "@/lib/admin/ibuResults";
import { redirect } from "next/navigation";
import {
  deleteRace,
  rescorePursuitAfterSprint,
  resetRaceResults,
  saveRaceResults,
  scoreRace,
  type ResultEntryInput,
} from "@/lib/admin/raceResults";

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
    revalidatePath("/admin", "layout");
    return {
      status: "success",
      message:
        `Résultats enregistrés, ${summary.scoredPredictions} pronostic(s) noté(s), séries 10/10 recalculées.` +
        (pursuitRescored ? " Poursuite de l'étape renotée avec ses nouvelles cotes." : ""),
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Erreur inconnue." };
  }
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

/** Modifie format, sexe, heure de départ (UTC) et course spéciale. */
export async function updateRace(formData: FormData) {
  await requireAdmin();
  const raceId = String(formData.get("race_id"));
  const format = String(formData.get("format"));
  const sex = String(formData.get("sex"));
  const specialRule = String(formData.get("special_rule"));
  // relais_h/f portent le sexe dans le format, les relais mixtes n'en ont pas.
  const sexless = format.startsWith("relais_");

  const { error } = await createAdminClient()
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
}

export async function resetResults(formData: FormData) {
  await requireAdmin();
  const raceId = String(formData.get("race_id"));
  const admin = createAdminClient();
  await resetRaceResults(admin, raceId);
  await rescorePursuitAfterSprint(admin, raceId);
  revalidatePath("/admin", "layout");
}

export async function removeRace(formData: FormData) {
  await requireAdmin();
  await deleteRace(createAdminClient(), String(formData.get("race_id")));
  revalidatePath("/admin", "layout");
  if (formData.get("redirect") === "1") redirect("/admin");
}
