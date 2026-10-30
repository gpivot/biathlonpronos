import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pictos d'un joueur à côté de son pseudo (Classement, pop-up joueur), repris de VéloPronos :
 * dossard jaune du leader, ⚡ bonus ×2 utilisés, 🍾 courses gagnées (meilleur pronostiqueur),
 * ❄️ Pépite révélée. Le leader dépend du classement affiché : il est passé à part.
 */
export interface PlayerBadges {
  x2Used: number;
  raceWins: number;
  pepites: number;
}

export const X2_PER_SEASON = 3;

export const NO_BADGES: PlayerBadges = { x2Used: 0, raceWins: 0, pepites: 0 };

/**
 * Partie pure (testée) : victoires de course par joueur. Le vainqueur d'une course est le joueur
 * qui y marque le plus de points (ex æquo : tous vainqueurs), à condition d'en marquer.
 */
export function countRaceWins(ledger: { userId: string; raceId: string | null; points: number }[]): Map<string, number> {
  const totals = new Map<string, Map<string, number>>();
  for (const row of ledger) {
    if (!row.raceId) continue;
    const byUser = totals.get(row.raceId) ?? new Map<string, number>();
    byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + Number(row.points));
    totals.set(row.raceId, byUser);
  }
  const wins = new Map<string, number>();
  for (const byUser of Array.from(totals.values())) {
    const best = Math.max(...Array.from(byUser.values()));
    if (!(best > 0)) continue;
    for (const [userId, points] of Array.from(byUser)) {
      if (points === best) wins.set(userId, (wins.get(userId) ?? 0) + 1);
    }
  }
  return wins;
}

/**
 * Pictos de tous les joueurs de la saison. Les ×2 joués sur des courses pas encore parties
 * restent invisibles pour les autres joueurs (pronostics cachés, migration 0018) ; les Pépites
 * ne sont lisibles qu'une fois révélées, ce qui est justement ce qu'on affiche.
 */
export async function getPlayerBadges(supabase: SupabaseClient, seasonId: string): Promise<Map<string, PlayerBadges>> {
  const [{ data: ledger }, { data: x2 }, { data: pepites }] = await Promise.all([
    supabase.from("score_ledger").select("user_id, race_id, points").eq("season_id", seasonId).not("race_id", "is", null),
    supabase
      .from("predictions")
      .select("user_id, races!inner(stages!inner(season_id))")
      .eq("bonus_x2_used", true)
      .eq("races.stages.season_id", seasonId),
    supabase.from("pepites").select("user_id").eq("season_id", seasonId).eq("bonus_claimed", true),
  ]);

  const badges = new Map<string, PlayerBadges>();
  const get = (userId: string) => {
    let entry = badges.get(userId);
    if (!entry) badges.set(userId, (entry = { ...NO_BADGES }));
    return entry;
  };
  const wins = countRaceWins(((ledger ?? []) as any[]).map((l) => ({ userId: l.user_id, raceId: l.race_id, points: l.points })));
  for (const [userId, count] of Array.from(wins)) get(userId).raceWins = count;
  for (const p of (x2 ?? []) as any[]) get(p.user_id).x2Used += 1;
  for (const p of (pepites ?? []) as any[]) get(p.user_id).pepites += 1;
  return badges;
}
