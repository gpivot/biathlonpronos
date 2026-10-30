import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Victoires et podiums de l'équipe favorite du joueur depuis le début de la saison (info ludique
 * de l'accueil depuis le retrait des bonus Team Nation et Aspiration). Courses individuelles :
 * biathlètes de la nation et du sexe de l'équipe ; relais : relais de ce sexe (pas les mixtes).
 */

export interface FavoriteTeamStats {
  wins: number;
  podiums: number;
}

export interface PodiumRow {
  rank: number;
  /** Course individuelle : nation et sexe du biathlète. */
  athlete: { nation_code: string; sex: string } | null;
  /** Relais : nation classée, et sexe de la course (null pour un relais mixte). */
  nationCode: string | null;
  raceSex: string | null;
}

/** Partie pure (testée). Un podium compte les victoires. */
export function countFavoriteTeamPodiums(rows: PodiumRow[], team: { nationCode: string; sex: string }): FavoriteTeamStats {
  let wins = 0;
  let podiums = 0;
  for (const row of rows) {
    if (row.rank > 3) continue;
    const isTeam = row.athlete
      ? row.athlete.nation_code === team.nationCode && row.athlete.sex === team.sex
      : row.nationCode === team.nationCode && row.raceSex === team.sex;
    if (!isTeam) continue;
    podiums += 1;
    if (row.rank === 1) wins += 1;
  }
  return { wins, podiums };
}

export async function getFavoriteTeamStats(
  supabase: SupabaseClient,
  seasonId: string,
  team: { nationCode: string; sex: string }
): Promise<FavoriteTeamStats> {
  const { data, error } = await supabase
    .from("race_results")
    .select("rank, nation_code, athletes(nation_code, sex), races!inner(sex, status, stages!inner(season_id))")
    .lte("rank", 3)
    .eq("races.status", "finished")
    .eq("races.stages.season_id", seasonId);
  if (error) console.error("getFavoriteTeamStats:", error.message);
  return countFavoriteTeamPodiums(
    ((data ?? []) as any[]).map((r) => ({
      rank: r.rank,
      athlete: r.athletes ?? null,
      nationCode: r.nation_code,
      raceSex: r.races?.sex ?? null,
    })),
    team
  );
}
