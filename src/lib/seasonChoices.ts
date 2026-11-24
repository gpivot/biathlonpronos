import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pépite cachée et équipe favorite (Guillaume, 24/11/2026) : modifiables jusqu'au départ de la
 * première course de Coupe du Monde de la saison (étape ×1 qui compte au classement ; les étapes
 * « Autre (×0) », ex. pré-saison, ne comptent pas), puis verrouillées.
 * Même règle côté base : first_world_cup_race_at / season_choices_editable (migration 0046).
 */
export async function getFirstWorldCupRaceAt(supabase: SupabaseClient, seasonId: string): Promise<Date | null> {
  const { data } = await supabase
    .from("races")
    .select("locks_at, stages!inner(season_id, coefficient, counts_in_standings)")
    .eq("stages.season_id", seasonId)
    .eq("stages.coefficient", 1)
    .eq("stages.counts_in_standings", true)
    .order("locks_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.locks_at ? new Date(data.locks_at as string) : null;
}

/** Encore modifiable ? Oui tant que la 1re course n'est pas partie (ou pas encore au calendrier). */
export function seasonChoicesEditable(firstWorldCupRaceAt: Date | null, now: Date): boolean {
  return firstWorldCupRaceAt === null || firstWorldCupRaceAt.getTime() > now.getTime();
}
