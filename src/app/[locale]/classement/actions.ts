"use server";

import { createClient } from "@/lib/supabase/server";
import { getClock } from "@/lib/clock";
import { getSeasonView, pickDefaultOpenStageId, type SeasonView } from "@/lib/seasonView";
import { getLeaderboard } from "@/lib/leaderboard";
import { getPlayerBadges, NO_BADGES, type PlayerBadges } from "@/lib/playerBadges";
import { getRaceResult } from "@/lib/lastResult";

export interface PlayerSeason extends SeasonView {
  pseudo: string;
  defaultOpenStageId: string | null;
  /** Place au classement général (null : aucun point encore) et total de points. */
  rank: number | null;
  points: number;
  favoriteTeam: { nationCode: string; name: string; sex: string } | null;
  /** Pictos (×2, victoires, Pépite) ; leader : en tête du classement général. */
  badges: PlayerBadges;
  leader: boolean;
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
  const [view, leaderboard, { data: favorite }, badges] = await Promise.all([
    getSeasonView(supabase, season, userId, now, userResult.user?.id === userId),
    getLeaderboard(supabase, season.id),
    // Équipe favorite d'un autre joueur : lisible grâce à la migration 0019.
    supabase.from("favorite_teams").select("nation_code, sex, nations(name)").eq("user_id", userId).eq("season_id", season.id).maybeSingle(),
    getPlayerBadges(supabase, season.id),
  ]);
  const rankIndex = leaderboard.findIndex((row) => row.userId === userId);
  return {
    ...view,
    pseudo: profile.pseudo ?? "?",
    // Étapes hors classement (ex. pré-saison) masquées dans le pop-up : jamais ouvertes par défaut.
    defaultOpenStageId: pickDefaultOpenStageId(view.stages.filter((s) => s.counts_in_standings !== false)),
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    points: rankIndex >= 0 ? leaderboard[rankIndex].points : 0,
    badges: badges.get(userId) ?? NO_BADGES,
    leader: rankIndex === 0 && leaderboard[0].points > 0,
    favoriteTeam: favorite
      ? { nationCode: favorite.nation_code, name: (favorite.nations as any)?.name ?? favorite.nation_code, sex: favorite.sex }
      : null,
  };
}

/** Détail d'une course terminée dans la fiche d'un joueur : points de chaque choix, bonus et Pépite. */
export interface PlayerRaceDetail {
  picks: { key: string; rank: number | null; name: string; nationCode: string; points: number | null }[];
  /** Lignes hors choix (bonus Top 5, malus, ×2, questions bonus…), chacune avec sa clé de traduction Home.* */
  extras: { labelKey: string; points: number }[];
  /** Pépite cachée révélée sur cette course. */
  pepite: { rank: number; name: string; nationCode: string; points: number } | null;
}

/**
 * Fiche d'un joueur (Classement) : détail de quelques courses terminées, chargé à la demande
 * (26/11/2026, variante « barres compactes » validée par Guillaume) : celles de l'étape filtrée, ou
 * les plus récentes de la saison par paquets. Seules les courses terminées sont lues : ses
 * pronostics sur les autres restent cachés (migration 0018).
 */
export async function getPlayerRaceDetails(userId: string, raceIds: string[]): Promise<Record<string, PlayerRaceDetail>> {
  const supabase = createClient();
  const { now } = await getClock();
  const { data: races } = await supabase
    .from("races")
    .select("id")
    .in("id", raceIds.slice(0, 20))
    .eq("status", "finished")
    .lte("locks_at", now.toISOString());
  const results = await Promise.all(
    ((races ?? []) as { id: string }[]).map((r) => getRaceResult(supabase, r.id, userId, { withPlayerRank: false }))
  );
  const details: Record<string, PlayerRaceDetail> = {};
  for (const result of results) {
    if (!result?.prediction && !result?.pepite) continue;
    const prediction = result.prediction;
    const extras: PlayerRaceDetail["extras"] = [
      ...(prediction?.extras ?? []).map((e) => ({ labelKey: `lastResultExtra_${e.kind}`, points: e.points })),
      ...(prediction?.multiplier
        ? [{ labelKey: prediction.multiplier.kind === "bonusX2" ? "playerExtraBonusX2" : "playerExtraCoefficient", points: prediction.multiplier.gain }]
        : []),
      ...(prediction?.bonusQuestionPoints ? [{ labelKey: "playerExtraBonusQuestions", points: prediction.bonusQuestionPoints }] : []),
    ];
    details[result.raceId] = {
      picks: (prediction?.picks ?? []).map((p) => ({ key: p.key, rank: p.rank, name: p.name, nationCode: p.nationCode, points: p.points })),
      extras,
      pepite: result.pepite,
    };
  }
  return details;
}
