import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./admin/fetchAll";
import { areJokersApplied, loadSeasonJokers } from "./jokers";

export interface LeaderboardRow {
  userId: string;
  pseudo: string;
  points: number;
}

/**
 * Classement général : agrégat du score_ledger, jamais recalculé à la main. En fin de saison, une
 * fois les jokers activés par l'admin (`seasons.jokers_applied`), les résultats qu'ils effacent sont
 * retirés du total (cf. src/lib/jokers.ts). Les courses des étapes « Autre (×0) », hors classement,
 * ne comptent pas (`score_ledger.counts_in_standings`, migration 0041).
 */
export async function getLeaderboard(supabase: SupabaseClient, seasonId: string): Promise<LeaderboardRow[]> {
  let ledger: any[];
  try {
    // Plus de 1000 lignes dès quelques courses avec beaucoup de joueurs : lecture par pages.
    ledger = await fetchAll<any>((from, to) =>
      supabase.from("score_ledger").select("id, user_id, points, profiles(pseudo)").eq("season_id", seasonId).eq("counts_in_standings", true).order("id").range(from, to)
    );
  } catch (error) {
    console.error("getLeaderboard:", (error as Error).message);
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

  if (totalsByUserId.size > 0 && (await areJokersApplied(supabase, seasonId))) {
    const jokers = await loadSeasonJokers(supabase, seasonId, Array.from(totalsByUserId.keys()));
    for (const [userId, selection] of Array.from(jokers)) {
      const row = totalsByUserId.get(userId);
      if (row) row.points = Math.round((row.points + selection.delta) * 10) / 10;
    }
  }

  return Array.from(totalsByUserId.values()).sort((a, b) => b.points - a.points);
}
