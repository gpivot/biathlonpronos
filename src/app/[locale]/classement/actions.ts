"use server";

import { createClient } from "@/lib/supabase/server";
import { getClock } from "@/lib/clock";
import { getSeasonView, pickDefaultOpenStageId, type SeasonView } from "@/lib/seasonView";
import { getLeaderboard } from "@/lib/leaderboard";

export interface PlayerSeason extends SeasonView {
  pseudo: string;
  defaultOpenStageId: string | null;
  /** Place au classement général (null : aucun point encore) et total de points. */
  rank: number | null;
  points: number;
  favoriteTeam: { nationCode: string; name: string; sex: string } | null;
}

/**
 * Pop-up d'un joueur du Classement : sa page « Ma saison » en lecture seule. Ses pronostics
 * sur les courses pas encore parties restent cachés (cf. getSeasonView et migration 0018).
 */
export async function getPlayerSeason(userId: string): Promise<PlayerSeason | null> {
  const supabase = createClient();
  const [{ data: season }, { data: profile }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id, starts_on").eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("pseudo").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!season || !profile) return null;

  const { now } = await getClock();
  const [view, leaderboard, { data: favorite }] = await Promise.all([
    getSeasonView(supabase, season, userId, now, userResult.user?.id === userId),
    getLeaderboard(supabase, season.id),
    // Équipe favorite d'un autre joueur : lisible grâce à la migration 0019.
    supabase.from("favorite_teams").select("nation_code, sex, nations(name)").eq("user_id", userId).eq("season_id", season.id).maybeSingle(),
  ]);
  const rankIndex = leaderboard.findIndex((row) => row.userId === userId);
  return {
    ...view,
    pseudo: profile.pseudo ?? "?",
    defaultOpenStageId: pickDefaultOpenStageId(view.stages),
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    points: rankIndex >= 0 ? leaderboard[rankIndex].points : 0,
    favoriteTeam: favorite
      ? { nationCode: favorite.nation_code, name: (favorite.nations as any)?.name ?? favorite.nation_code, sex: favorite.sex }
      : null,
  };
}
