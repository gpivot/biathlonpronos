import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAspirationBonus,
  computeIndividualRaceScore,
  computePepiteBonus,
  computePursuitOdds,
  computeRelayScore,
  updateStreak,
  type AthleteRaceResult,
  type BonusCardEffect,
  type FavoriteTeam,
  type NationRaceResult,
} from "@/lib/scoring";
import { setCurrentOdds } from "./odds";

const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

export interface ResultEntryInput {
  /** Course individuelle. */
  athleteId?: string;
  /** Relais — la nation prend la place de l'athlète. */
  nationCode?: string;
  rank: number;
  timeGapSeconds?: number;
  penaltyLaps?: number;
  isFusee?: boolean;
  isGachette?: boolean;
}

/**
 * Enregistre les résultats d'une course (remplace toute saisie précédente)
 * et, si c'est un sprint, fige la cote poursuite de chaque athlète pour la
 * course suivante de l'étape (§4 du règlement) à partir des écarts saisis.
 */
export async function saveRaceResults(
  admin: SupabaseClient,
  raceId: string,
  entries: ResultEntryInput[]
): Promise<void> {
  const { data: race, error: raceError } = await admin
    .from("races")
    .select("id, stage_id, sex, format, stages(season_id)")
    .eq("id", raceId)
    .single();
  if (raceError || !race) throw new Error(raceError?.message ?? "Course introuvable.");

  await admin.from("race_results").delete().eq("race_id", raceId);

  if (entries.length > 0) {
    const { error } = await admin.from("race_results").insert(
      entries.map((e) => ({
        race_id: raceId,
        athlete_id: e.athleteId ?? null,
        nation_code: e.nationCode ?? null,
        rank: e.rank,
        time_gap_seconds: e.timeGapSeconds ?? null,
        penalty_laps: e.penaltyLaps ?? 0,
        is_fusee: e.isFusee ?? false,
        is_gachette: e.isGachette ?? false,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (race.format === "sprint") {
    await cascadePursuitOdds(admin, race.stage_id, race.sex, (race.stages as any).season_id, entries);
  }
}

async function cascadePursuitOdds(
  admin: SupabaseClient,
  stageId: string,
  sex: string | null,
  seasonId: string,
  sprintEntries: ResultEntryInput[]
): Promise<void> {
  const { data: pursuitRace } = await admin
    .from("races")
    .select("id")
    .eq("stage_id", stageId)
    .eq("format", "poursuite")
    .eq("sex", sex)
    .maybeSingle();
  if (!pursuitRace) return;

  const athleteIds = sprintEntries.map((e) => e.athleteId!).filter(Boolean);
  const { data: sprintOdds } = await admin
    .from("odds")
    .select("athlete_id, value")
    .eq("season_id", seasonId)
    .eq("format", "sprint")
    .is("valid_until", null)
    .in("athlete_id", athleteIds);

  const baseOddsByAthleteId = new Map((sprintOdds ?? []).map((o) => [o.athlete_id as string, o.value as number]));

  const toUpdate = sprintEntries.filter(
    (e) => e.athleteId && e.timeGapSeconds != null && baseOddsByAthleteId.has(e.athleteId)
  );
  for (const entry of toUpdate) {
    await setCurrentOdds(admin, {
      seasonId,
      format: "poursuite",
      athleteId: entry.athleteId!,
      value: computePursuitOdds(baseOddsByAthleteId.get(entry.athleteId!)!, entry.timeGapSeconds!),
    });
  }
}

export interface ScoreRaceSummary {
  scoredPredictions: number;
}

/**
 * Calcule et écrit le score de chaque pronostic déposé sur la course, met à
 * jour les séries 10/10 (§12 : "hommes et femmes confondus ainsi que
 * relais"), puis marque la course comme terminée. Ré-exécutable sans
 * dupliquer (score_ledger_user_race_unique, cf. migration 0006).
 */
export async function scoreRace(admin: SupabaseClient, raceId: string): Promise<ScoreRaceSummary> {
  const { data: race, error: raceError } = await admin
    .from("races")
    .select("id, sex, format, special_rule, stages(id, season_id, country_code, coefficient)")
    .eq("id", raceId)
    .single();
  if (raceError || !race) throw new Error(raceError?.message ?? "Course introuvable.");

  const stage = race.stages as any;

  const [{ data: results }, { data: predictions }] = await Promise.all([
    admin.from("race_results").select("*").eq("race_id", raceId),
    admin.from("predictions").select("*").eq("race_id", raceId),
  ]);

  // §14 — la Pépite est indépendante du pronostic du joueur sur cette
  // course précise : à vérifier même si personne n'a pronostiqué dessus.
  await applyPepiteBonuses(admin, stage.season_id, raceId, race.format, results ?? []);

  if (!predictions || predictions.length === 0) {
    await admin.from("races").update({ status: "finished" }).eq("id", raceId);
    return { scoredPredictions: 0 };
  }

  const pointsByUserId = RELAY_FORMATS.includes(race.format)
    ? await scoreRelayPredictions(admin, race, stage, results ?? [], predictions)
    : await scoreIndividualPredictions(admin, race, stage, results ?? [], predictions);

  await updateStreaks(admin, stage.season_id, pointsByUserId);
  await admin.from("races").update({ status: "finished" }).eq("id", raceId);

  return { scoredPredictions: pointsByUserId.size };
}

/**
 * §14 — la Pépite est un pronostic caché : sur chaque course individuelle
 * où elle termine dans le Top 10 pour la 1re fois de la saison, son score
 * (cote de la course × multiplicateur de rang, §1) s'ajoute en bonus. Elle
 * n'est ensuite plus jamais réévaluée (bonus_claimed = true).
 */
async function applyPepiteBonuses(
  admin: SupabaseClient,
  seasonId: string,
  raceId: string,
  raceFormat: string,
  results: any[]
): Promise<void> {
  const top10Results = results.filter((r) => r.athlete_id && r.rank <= 10);
  if (top10Results.length === 0) return;

  const athleteIds = top10Results.map((r) => r.athlete_id as string);

  const { data: pepites } = await admin
    .from("pepites")
    .select("user_id, sex, athlete_id")
    .eq("season_id", seasonId)
    .eq("bonus_claimed", false)
    .in("athlete_id", athleteIds);
  if (!pepites || pepites.length === 0) return;

  const { data: odds } = await admin
    .from("odds")
    .select("athlete_id, value")
    .eq("season_id", seasonId)
    .eq("format", raceFormat)
    .is("valid_until", null)
    .in("athlete_id", athleteIds);
  const oddsByAthleteId = new Map((odds ?? []).map((o) => [o.athlete_id as string, o.value as number]));
  const rankByAthleteId = new Map(top10Results.map((r) => [r.athlete_id as string, r.rank as number]));

  for (const pepite of pepites) {
    const rank = rankByAthleteId.get(pepite.athlete_id);
    const oddsAtRace = oddsByAthleteId.get(pepite.athlete_id);
    if (rank == null || oddsAtRace == null) continue;

    const bonus = computePepiteBonus(oddsAtRace, rank);
    if (bonus <= 0) continue;

    const { data: existing } = await admin
      .from("score_ledger")
      .select("points, breakdown")
      .eq("user_id", pepite.user_id)
      .eq("race_id", raceId)
      .maybeSingle();

    await admin.from("score_ledger").upsert(
      {
        user_id: pepite.user_id,
        season_id: seasonId,
        race_id: raceId,
        points: (existing?.points ?? 0) + bonus,
        breakdown: { ...((existing?.breakdown as object) ?? {}), pepiteBonus: bonus },
      },
      { onConflict: "user_id,race_id" }
    );

    await admin
      .from("pepites")
      .update({ bonus_claimed: true })
      .eq("user_id", pepite.user_id)
      .eq("season_id", seasonId)
      .eq("sex", pepite.sex);
  }
}

async function scoreIndividualPredictions(
  admin: SupabaseClient,
  race: any,
  stage: any,
  results: any[],
  predictions: any[]
): Promise<Map<string, number>> {
  const athleteIds = new Set<string>();
  for (const r of results) if (r.athlete_id) athleteIds.add(r.athlete_id);
  for (const p of predictions) for (const id of p.athlete_ids ?? []) athleteIds.add(id);

  const [{ data: athletes }, { data: odds }, { data: favoriteTeams }] = await Promise.all([
    admin.from("athletes").select("id, nation_code, sex").in("id", Array.from(athleteIds)),
    admin
      .from("odds")
      .select("athlete_id, value")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null)
      .in("athlete_id", Array.from(athleteIds)),
    admin.from("favorite_teams").select("user_id, nation_code, sex").eq("season_id", stage.season_id),
  ]);

  const athleteTeamByAthleteId: Record<string, { nationCode: string; sex: "H" | "F" }> = {};
  for (const a of athletes ?? []) athleteTeamByAthleteId[a.id] = { nationCode: a.nation_code, sex: a.sex };

  const oddsByAthleteId: Record<string, number> = {};
  for (const o of odds ?? []) oddsByAthleteId[o.athlete_id as string] = o.value;

  const favoriteTeamByUserId = new Map<string, FavoriteTeam>(
    (favoriteTeams ?? []).map((f) => [f.user_id as string, { nationCode: f.nation_code, sex: f.sex }])
  );

  const scoringResults: AthleteRaceResult[] = results
    .filter((r) => r.athlete_id)
    .map((r) => ({
      athleteId: r.athlete_id as string,
      rank: r.rank,
      penaltyLaps: r.penalty_laps,
      isFusee: r.is_fusee,
      isGachette: r.is_gachette,
    }));

  const scoreLedgerRows = [];
  const pointsByUserId = new Map<string, number>();

  for (const prediction of predictions) {
    const favoriteTeam = favoriteTeamByUserId.get(prediction.user_id) ?? null;

    const card: BonusCardEffect =
      prediction.bonus_card_used === "ca_farte" && prediction.bonus_card_target_athlete_id
        ? { type: "ca_farte", targetAthleteId: prediction.bonus_card_target_athlete_id }
        : prediction.bonus_card_used === "balle_de_pioche"
          ? { type: "balle_de_pioche" }
          : { type: "none" };

    const result = computeIndividualRaceScore({
      predictedAthleteIds: prediction.athlete_ids ?? [],
      results: scoringResults,
      oddsByAthleteId,
      athleteTeamByAthleteId,
      specialRule: race.special_rule,
      stageCoefficient: stage.coefficient,
      bonusX2Active: prediction.bonus_x2_used,
      card,
      favoriteTeam,
      raceCountryCode: stage.country_code,
    });

    const aspirationBonus = computeAspirationBonus(scoringResults, athleteTeamByAthleteId, favoriteTeam);
    const totalPoints = result.total + aspirationBonus;

    scoreLedgerRows.push({
      user_id: prediction.user_id,
      season_id: stage.season_id,
      race_id: race.id,
      points: totalPoints,
      breakdown: { ...result.breakdown, aspirationBonus },
    });
    pointsByUserId.set(prediction.user_id, totalPoints);
  }

  const { error } = await admin.from("score_ledger").upsert(scoreLedgerRows, { onConflict: "user_id,race_id" });
  if (error) throw new Error(error.message);

  return pointsByUserId;
}

/**
 * §5 — scoring des relais : cote × rang uniquement (pas de bonus de
 * combinaison ni de malus de course spéciale, non mentionnés pour les
 * relais dans le règlement — à confirmer par Guillaume si besoin).
 */
async function scoreRelayPredictions(
  admin: SupabaseClient,
  race: any,
  stage: any,
  results: any[],
  predictions: any[]
): Promise<Map<string, number>> {
  const nationCodes = new Set<string>();
  for (const r of results) if (r.nation_code) nationCodes.add(r.nation_code);
  for (const p of predictions) if (p.nation_code) nationCodes.add(p.nation_code);

  const { data: odds } = await admin
    .from("odds")
    .select("nation_code, value")
    .eq("season_id", stage.season_id)
    .eq("format", race.format)
    .is("valid_until", null)
    .in("nation_code", Array.from(nationCodes));

  const oddsByNationCode: Record<string, number> = {};
  for (const o of odds ?? []) if (o.nation_code) oddsByNationCode[o.nation_code] = o.value;

  const relayResults: NationRaceResult[] = results
    .filter((r) => r.nation_code)
    .map((r) => ({ nationCode: r.nation_code as string, rank: r.rank }));

  const scoreLedgerRows = [];
  const pointsByUserId = new Map<string, number>();

  for (const prediction of predictions) {
    if (!prediction.nation_code) continue;

    const result = computeRelayScore({
      predictedNationCode: prediction.nation_code,
      results: relayResults,
      oddsByNationCode,
      stageCoefficient: stage.coefficient,
      bonusX2Active: prediction.bonus_x2_used,
    });

    scoreLedgerRows.push({
      user_id: prediction.user_id,
      season_id: stage.season_id,
      race_id: race.id,
      points: result.total,
      breakdown: result.breakdown,
    });
    pointsByUserId.set(prediction.user_id, result.total);
  }

  if (scoreLedgerRows.length > 0) {
    const { error } = await admin.from("score_ledger").upsert(scoreLedgerRows, { onConflict: "user_id,race_id" });
    if (error) throw new Error(error.message);
  }

  return pointsByUserId;
}

async function updateStreaks(
  admin: SupabaseClient,
  seasonId: string,
  pointsByUserId: Map<string, number>
): Promise<void> {
  if (pointsByUserId.size === 0) return;

  const { data: streaks } = await admin
    .from("streak_counters")
    .select("user_id, current_streak, cards_earned")
    .eq("season_id", seasonId)
    .in("user_id", Array.from(pointsByUserId.keys()));

  const streakByUserId = new Map((streaks ?? []).map((s) => [s.user_id as string, s]));

  // §12 — au 10/10, cards_earned est un crédit ; le joueur choisit lui-même
  // le type de carte (écran /compte), il n'est pas attribué au hasard ici.
  const streakUpsertRows = Array.from(pointsByUserId.entries()).map(([userId, points]) => {
    const current = streakByUserId.get(userId);
    const update = updateStreak(current?.current_streak ?? 0, points);
    return {
      user_id: userId,
      season_id: seasonId,
      current_streak: update.currentStreak,
      cards_earned: (current?.cards_earned ?? 0) + (update.cardEarned ? 1 : 0),
    };
  });

  const { error } = await admin.from("streak_counters").upsert(streakUpsertRows, { onConflict: "user_id,season_id" });
  if (error) throw new Error(error.message);
}
