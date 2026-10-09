import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeaderboardRow {
  userId: string;
  pseudo: string;
  points: number;
}

/** Classement général : agrégat du score_ledger, jamais recalculé à la main. */
export async function getLeaderboard(supabase: SupabaseClient, seasonId: string): Promise<LeaderboardRow[]> {
  const { data: ledger, error } = await supabase
    .from("score_ledger")
    .select("user_id, points, profiles(pseudo)")
    .eq("season_id", seasonId);

  if (error) {
    console.error("getLeaderboard:", error.message);
    return [];
  }

  const totalsByUserId = new Map<string, LeaderboardRow>();
  for (const entry of ledger ?? []) {
    const pseudo = (entry.profiles as any)?.pseudo ?? "?";
    const existing = totalsByUserId.get(entry.user_id);
    if (existing) {
      existing.points += entry.points;
    } else {
      totalsByUserId.set(entry.user_id, { userId: entry.user_id, pseudo, points: entry.points });
    }
  }

  return Array.from(totalsByUserId.values()).sort((a, b) => b.points - a.points);
}
