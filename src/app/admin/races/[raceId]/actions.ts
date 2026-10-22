"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchIbuResults } from "@/lib/admin/ibuResults";
import { saveRaceResults, scoreRace, type ResultEntryInput } from "@/lib/admin/raceResults";

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
    revalidatePath(`/admin/races/${raceId}`);
    revalidatePath("/admin");
    return {
      status: "success",
      message: `Résultats enregistrés, ${summary.scoredPredictions} pronostic(s) noté(s).`,
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
