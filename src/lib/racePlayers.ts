import type { SupabaseClient } from "@supabase/supabase-js";

/** Classement des joueurs sur une course notée (page de la course). */
export interface RacePlayerRow {
  userId: string;
  pseudo: string;
  points: number;
  /** Place, ex æquo compris (deux joueurs à 120 pts sont tous deux 1ers, le suivant est 3e). */
  rank: number;
}

/** Partie pure (testée) : tri décroissant et places avec ex æquo. */
export function rankPlayers(rows: Omit<RacePlayerRow, "rank">[]): RacePlayerRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.pseudo.localeCompare(b.pseudo));
  return sorted.map((row) => ({
    ...row,
    rank: sorted.findIndex((r) => r.points === row.points) + 1,
  }));
}

export async function getRacePlayers(supabase: SupabaseClient, raceId: string): Promise<RacePlayerRow[]> {
  const { data, error } = await supabase.from("score_ledger").select("user_id, points, profiles(pseudo)").eq("race_id", raceId);
  if (error) console.error("getRacePlayers:", error.message);
  return rankPlayers(
    (data ?? []).map((row: any) => ({ userId: row.user_id, pseudo: row.profiles?.pseudo ?? "?", points: Number(row.points) }))
  );
}
