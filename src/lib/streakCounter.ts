import type { SupabaseClient } from "@supabase/supabase-js";

/** Série en cours d'un joueur sur la saison (0 s'il n'a pas encore de compteur). */
export async function getCurrentStreak(supabase: SupabaseClient, seasonId: string, userId: string): Promise<number> {
  const { data } = await supabase
    .from("streak_counters")
    .select("current_streak")
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.current_streak ?? 0;
}
