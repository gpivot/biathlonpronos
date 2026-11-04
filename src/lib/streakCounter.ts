import type { SupabaseClient } from "@supabase/supabase-js";

/** Vrai dès qu'au moins une course de la saison a été notée (statut « finished »). */
export async function seasonHasFinishedRace(supabase: SupabaseClient, seasonId: string): Promise<boolean> {
  const { count } = await supabase
    .from("races")
    .select("id, stages!inner(season_id)", { count: "exact", head: true })
    .eq("stages.season_id", seasonId)
    .eq("status", "finished");
  return (count ?? 0) > 0;
}

/**
 * Série en cours d'un joueur sur la saison (0 s'il n'a pas encore de compteur). La série est propre
 * à chaque saison et n'existe qu'à partir de la 1re course notée : avant, renvoie null (rien
 * d'affiché), même si un ancien compteur traîne en base (course de test supprimée hors de l'admin…).
 */
export async function getCurrentStreak(supabase: SupabaseClient, seasonId: string, userId: string): Promise<number | null> {
  const [started, { data }] = await Promise.all([
    seasonHasFinishedRace(supabase, seasonId),
    supabase
      .from("streak_counters")
      .select("current_streak")
      .eq("season_id", seasonId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!started) return null;
  return data?.current_streak ?? 0;
}
