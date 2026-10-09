"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { saveRaceResults, scoreRace, type ResultEntryInput } from "@/lib/admin/raceResults";

export interface SubmitResultsState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitResults(
  raceId: string,
  entries: ResultEntryInput[]
): Promise<SubmitResultsState> {
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
