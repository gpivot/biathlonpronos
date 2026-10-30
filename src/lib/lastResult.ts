import type { SupabaseClient } from "@supabase/supabase-js";
import { COMBINATION_BONUS, FUSEE_BONUS, GACHETTE_BONUS, RANK_MULTIPLIERS, RELAY_RANK_MULTIPLIERS } from "./scoring/constants";
import { RELAY_FORMATS } from "./grilling";
import { applyFuseeGachetteRules } from "./scoring/fuseeGachette";
import { shortAthleteName } from "./athleteName";

/**
 * Encart « Dernier résultat » de l'accueil (inspiré de VéloPronos) : la
 * dernière course notée de la saison, ses points pour le joueur et le détail
 * par athlète/nation pronostiqué.
 */

export interface LastResultPick {
  key: string;
  name: string;
  nationCode: string;
  /** Place obtenue, null si hors du classement saisi. */
  rank: number | null;
  /** Points rapportés par ce choix, null s'il n'a pas compté (Balle de pioche). */
  points: number | null;
  /** Choix visé par la carte « Ça farte » (×3). */
  caFarte: boolean;
  /** Meilleur temps de ski (+50) / sans-faute au tir (+20), déjà inclus dans `points`. */
  fusee: boolean;
  gachette: boolean;
  /** Fautes au tir, une valeur par tir (null : non saisies). */
  shootings: number[] | null;
}

/** Une ligne du classement de la course, avec les points du barème (cote × rang + Fusée/Gâchette). */
export interface RaceResultRow {
  rank: number;
  name: string;
  nationCode: string;
  /** null : aucun point au barème (hors Top 10, ou Top 5 pour un relais). */
  points: number | null;
  fusee: boolean;
  gachette: boolean;
  /** Fautes au tir, une valeur par tir (null : non saisies). */
  shootings: number[] | null;
  /** Ligne pronostiquée par le joueur. */
  mine: boolean;
  /** L'un des 3 meilleurs scores du barème : le trio du Prono parfait (courses individuelles). */
  perfect: boolean;
}

export interface LastResultExtra {
  /** Clé de traduction (Home.lastResultExtra_<kind>). */
  kind: "top3" | "top5" | "top10" | "pronoParfait" | "specialMalus" | "aspiration" | "pepite";
  points: number;
}

export interface LastResult {
  raceId: string;
  format: string;
  sex: string | null;
  locksAt: string;
  location: string;
  countryCode: string;
  coefficient: number;
  podium: { rank: number; name: string; nationCode: string }[];
  /** Classement complet saisi par l'admin. */
  results: RaceResultRow[];
  /** null : le joueur n'avait pas pronostiqué cette course. */
  prediction: {
    points: number;
    /** Points de chaque choix, sans le bonus ×2 ni le coefficient Mondiaux/JO (affichés à part, cf. multiplier). */
    picks: LastResultPick[];
    /** Bonus ×2 perso ou coefficient ×2 de l'étape, et ce qu'il a rapporté en plus. */
    multiplier: { kind: "bonusX2" | "coefficient"; gain: number } | null;
    extras: LastResultExtra[];
    bonusX2: boolean;
    card: string | null;
    /** Place du joueur parmi tous les pronostiqueurs de la course. */
    playerRank: number | null;
    playerCount: number;
  } | null;
}

interface ResultRow {
  rank: number;
  athlete_id: string | null;
  nation_code: string | null;
  is_fusee: boolean;
  is_gachette: boolean;
}

interface IndividualBreakdown {
  base?: Record<string, number>;
  combinationBonus?: number;
  pronoParfaitBonus?: number;
  specialMalus?: number;
  droppedByBalleDePioche?: string[];
  teamNationBoostedAthleteIds?: string[];
  aspirationBonus?: number;
  pepiteBonus?: number;
}

/**
 * Reconstitue les points de chaque athlète pronostiqué à partir du détail
 * enregistré dans score_ledger.breakdown, en rejouant les multiplicateurs du
 * moteur (cf. computeIndividualRaceScore) : Fusée/Gâchette, Balle de pioche,
 * Ça farte ×3, coefficient Mondiaux/JO ou bonus ×2 perso, Team Nation ×2.
 */
export function computeIndividualPickPoints(params: {
  athleteIds: string[];
  breakdown: IndividualBreakdown;
  results: Pick<ResultRow, "athlete_id" | "is_fusee" | "is_gachette">[];
  stageCoefficient: number;
  bonusX2: boolean;
  caFarteTargetId: string | null;
}): Record<string, number | null> {
  const { athleteIds, breakdown, results, stageCoefficient, bonusX2, caFarteTargetId } = params;
  const resultByAthleteId = new Map(results.filter((r) => r.athlete_id).map((r) => [r.athlete_id!, r]));
  const dropped = new Set(breakdown.droppedByBalleDePioche ?? []);
  const teamNation = new Set(breakdown.teamNationBoostedAthleteIds ?? []);
  const globalMultiplier = stageCoefficient === 2 ? 2 : bonusX2 ? 2 : 1;

  const points: Record<string, number | null> = {};
  for (const id of athleteIds) {
    if (dropped.has(id)) {
      points[id] = null;
      continue;
    }
    const result = resultByAthleteId.get(id);
    const raw =
      (breakdown.base?.[id] ?? 0) +
      (result?.is_fusee ? FUSEE_BONUS : 0) +
      (result?.is_gachette ? GACHETTE_BONUS : 0);
    points[id] = id === caFarteTargetId ? raw * 3 : raw * globalMultiplier * (teamNation.has(id) ? 2 : 1);
  }
  return points;
}

/** Palier du bonus de combinaison, retrouvé à partir de son montant (Top 3 = 100, Top 5 = 50, Top 10 = 20). */
function combinationTierKind(points: number): "top3" | "top5" | "top10" {
  if (points >= COMBINATION_BONUS.podium) return "top3";
  if (points >= COMBINATION_BONUS.top5) return "top5";
  return "top10";
}

/** Bonus et malus de course qui ne sont rattachés à aucun athlète en particulier. */
export function computeIndividualExtras(breakdown: IndividualBreakdown): LastResultExtra[] {
  const combination = breakdown.combinationBonus ?? 0;
  const extras: LastResultExtra[] = [
    { kind: combinationTierKind(combination), points: combination },
    { kind: "pronoParfait", points: breakdown.pronoParfaitBonus ?? 0 },
    { kind: "specialMalus", points: breakdown.specialMalus ?? 0 },
    { kind: "aspiration", points: breakdown.aspirationBonus ?? 0 },
    { kind: "pepite", points: breakdown.pepiteBonus ?? 0 },
  ];
  return extras.filter((e) => e.points !== 0);
}

/**
 * Les 3 lignes au plus fort score du barème (Top 10, Fusée/Gâchette comprises) : le trio du
 * Prono parfait, comme computeBestPossibleTrio du moteur (même tri, ordre d'arrivée en cas d'égalité).
 */
export function markPronoParfait<T extends { rank: number; points: number | null }>(rows: T[]): (T & { perfect: boolean })[] {
  const best = new Set(
    rows
      .filter((r) => r.rank <= 10 && r.points != null)
      .sort((a, b) => b.points! - a.points! || a.rank - b.rank)
      .slice(0, 3)
  );
  return rows.map((r) => ({ ...r, perfect: best.size === 3 && best.has(r) }));
}

/** Points du barème pour une ligne de résultat, sans les multiplicateurs propres à chaque joueur. */
export function computeResultRowPoints(params: {
  rank: number;
  odds: number | undefined;
  relay: boolean;
  isFusee: boolean;
  isGachette: boolean;
}): number | null {
  const { rank, odds, relay, isFusee, isGachette } = params;
  const multiplier = (relay ? RELAY_RANK_MULTIPLIERS : RANK_MULTIPLIERS)[rank];
  const base = multiplier && odds != null ? multiplier * odds : 0;
  const bonus = relay ? 0 : (isFusee ? FUSEE_BONUS : 0) + (isGachette ? GACHETTE_BONUS : 0);
  return base + bonus > 0 ? base + bonus : null;
}

const RACE_SELECT = "id, format, sex, locks_at, stages!inner(location, country_code, coefficient, season_id)";

/** Durée pendant laquelle le dernier résultat de chaque catégorie reste affiché sur l'accueil. */
export const LAST_RESULTS_WINDOW_MS = 48 * 3600 * 1000;

/**
 * Partie pure (testée) de « Derniers résultats » : la dernière course notée de
 * chaque catégorie (Hommes, Femmes, mixte) partie dans les 48 dernières heures,
 * un nouveau résultat d'une catégorie remplaçant le précédent. Sans résultat
 * dans les 48 h, la dernière course notée reste affichée seule.
 */
export function pickLastResultRaces<T extends { sex: string | null; locks_at: string }>(racesNewestFirst: T[], now: Date): T[] {
  const since = now.getTime() - LAST_RESULTS_WINDOW_MS;
  const byCategory = new Map<string, T>();
  for (const race of racesNewestFirst) {
    if (new Date(race.locks_at).getTime() < since) break;
    const category = race.sex ?? "mixte";
    if (!byCategory.has(category)) byCategory.set(category, race);
  }
  const picked = byCategory.size > 0 ? Array.from(byCategory.values()) : racesNewestFirst.slice(0, 1);
  // Le plus récent en haut (demande de Guillaume).
  return picked.sort((x, y) => y.locks_at.localeCompare(x.locks_at));
}

/** « Derniers résultats » de l'accueil (voir pickLastResultRaces). */
export async function getLastResults(
  supabase: SupabaseClient,
  seasonId: string,
  userId: string,
  now: Date,
  /** Résultat du jour déjà affiché dans « L'étape de la semaine » : il ne bascule ici qu'à minuit. */
  excludeRaceId: string | null = null
): Promise<LastResult[]> {
  // Quelques courses suffisent : au plus une par catégorie dans les 48 h.
  const { data: races } = await supabase
    .from("races")
    .select(RACE_SELECT)
    .eq("stages.season_id", seasonId)
    .eq("status", "finished")
    .lte("locks_at", now.toISOString())
    .order("locks_at", { ascending: false })
    .limit(12);
  const picked = pickLastResultRaces(((races ?? []) as any[]).filter((r) => r.id !== excludeRaceId), now);
  return Promise.all(picked.map((race) => buildRaceResult(supabase, race, userId)));
}

/** Même détail pour une course donnée (page d'une course terminée). */
export async function getRaceResult(supabase: SupabaseClient, raceId: string, userId: string | null): Promise<LastResult | null> {
  const { data: race } = await supabase.from("races").select(RACE_SELECT).eq("id", raceId).maybeSingle();
  return race ? buildRaceResult(supabase, race, userId) : null;
}

async function buildRaceResult(supabase: SupabaseClient, race: any, userId: string | null): Promise<LastResult> {
  const stage = race.stages as any as { location: string; country_code: string; coefficient: number; season_id: string };
  const relay = RELAY_FORMATS.includes(race.format);

  const [{ data: results }, { data: prediction }, { data: ledger }, { data: odds }] = await Promise.all([
    supabase
      .from("race_results")
      .select("rank, athlete_id, nation_code, is_fusee, is_gachette, shootings, athletes(first_name, last_name, nation_code), nations(name)")
      .eq("race_id", race.id)
      .order("rank", { ascending: true }),
    userId
      ? supabase
          .from("predictions")
          .select("athlete_ids, nation_code, bonus_x2_used, bonus_card_used, bonus_card_target_athlete_id")
          .eq("user_id", userId)
          .eq("race_id", race.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    userId
      ? supabase.from("score_ledger").select("points, breakdown").eq("user_id", userId).eq("race_id", race.id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    // Cotes en vigueur, celles qu'utilise le calcul des points (cf. scoreRace).
    supabase
      .from("odds")
      .select(relay ? "nation_code, value" : "athlete_id, value")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null),
  ]);

  const resultRows = ((results ?? []) as any[]).map((r) => applyFuseeGachetteRules(race.format, r));
  const shortName = (a: { first_name?: string; last_name?: string } | null | undefined) =>
    shortAthleteName(a, "");
  const rowName = (r: any) => (r.athlete_id ? shortName(r.athletes) : r.nations?.name ?? r.nation_code);
  const rowNation = (r: any) => (r.athlete_id ? r.athletes?.nation_code ?? "" : r.nation_code);

  const podium = resultRows
    .filter((r) => r.rank <= 3)
    .map((r) => ({ rank: r.rank as number, name: rowName(r), nationCode: rowNation(r) }));

  const oddsByKey = new Map(((odds ?? []) as any[]).map((o) => [(relay ? o.nation_code : o.athlete_id) as string, o.value as number]));
  const predictedKeys = new Set<string>(prediction?.nation_code ? [prediction.nation_code] : prediction?.athlete_ids ?? []);
  const scoredRows = resultRows.map((r) => ({
    rank: r.rank,
    name: rowName(r),
    nationCode: rowNation(r),
    points: computeResultRowPoints({
      rank: r.rank,
      odds: oddsByKey.get(r.athlete_id ?? r.nation_code),
      relay,
      isFusee: r.is_fusee,
      isGachette: r.is_gachette,
    }),
    fusee: r.is_fusee,
    gachette: r.is_gachette,
    shootings: r.shootings ?? null,
    mine: predictedKeys.has(r.athlete_id ?? r.nation_code),
  }));
  const fullResults: RaceResultRow[] = relay ? scoredRows.map((r) => ({ ...r, perfect: false })) : markPronoParfait(scoredRows);

  const base: Omit<LastResult, "prediction"> = {
    raceId: race.id,
    format: race.format,
    sex: race.sex,
    locksAt: race.locks_at,
    location: stage.location,
    countryCode: stage.country_code,
    coefficient: stage.coefficient,
    podium,
    results: fullResults,
  };

  const hasPrediction = prediction && ((prediction.athlete_ids?.length ?? 0) > 0 || prediction.nation_code);
  if (!hasPrediction) return { ...base, prediction: null };

  const points = Number(ledger?.points ?? 0);
  const breakdown = (ledger?.breakdown ?? {}) as IndividualBreakdown;

  // Place du joueur : 1 + nombre de pronostiqueurs ayant fait strictement mieux.
  const [{ count: betterCount }, { count: playerCount }] = await Promise.all([
    supabase.from("score_ledger").select("id", { count: "exact", head: true }).eq("race_id", race.id).gt("points", points),
    supabase.from("score_ledger").select("id", { count: "exact", head: true }).eq("race_id", race.id),
  ]);

  let picks: LastResultPick[];
  let extras: LastResultExtra[] = [];
  // Bonus ×2 perso ou coefficient Mondiaux/JO (non cumulables) : sorti du détail par choix.
  const multiplierKind: "bonusX2" | "coefficient" | null =
    stage.coefficient === 2 ? "coefficient" : prediction.bonus_x2_used ? "bonusX2" : null;
  let multiplierGain = 0;

  if (prediction.nation_code) {
    const row = resultRows.find((r) => r.nation_code === prediction.nation_code);
    let name = row ? rowName(row) : prediction.nation_code;
    if (!row) {
      const { data: nation } = await supabase.from("nations").select("name").eq("code", prediction.nation_code).maybeSingle();
      name = nation?.name ?? prediction.nation_code;
    }
    multiplierGain = multiplierKind ? points / 2 : 0;
    picks = [
      {
        key: prediction.nation_code,
        name,
        nationCode: prediction.nation_code,
        rank: row?.rank ?? null,
        points: multiplierKind ? points / 2 : points,
        caFarte: false,
        fusee: false,
        gachette: false,
        shootings: row?.shootings ?? null,
      },
    ];
  } else {
    const athleteIds: string[] = prediction.athlete_ids ?? [];
    const caFarteTargetId =
      prediction.bonus_card_used === "ca_farte" ? prediction.bonus_card_target_athlete_id ?? null : null;
    const pickPointsParams = { athleteIds, breakdown, results: resultRows, caFarteTargetId };
    const pickPoints = computeIndividualPickPoints({ ...pickPointsParams, stageCoefficient: 1, bonusX2: false });
    const multipliedPoints = computeIndividualPickPoints({
      ...pickPointsParams,
      stageCoefficient: stage.coefficient,
      bonusX2: prediction.bonus_x2_used,
    });
    const sum = (byId: Record<string, number | null>) => Object.values(byId).reduce<number>((total, v) => total + (v ?? 0), 0);
    multiplierGain = sum(multipliedPoints) - sum(pickPoints);

    // Athlètes pronostiqués absents du classement saisi : nom chargé à part.
    const missingIds = athleteIds.filter((id) => !resultRows.some((r) => r.athlete_id === id));
    const { data: missingAthletes } = missingIds.length
      ? await supabase.from("athletes").select("id, first_name, last_name, nation_code").in("id", missingIds)
      : { data: [] as any[] };

    picks = athleteIds.map((id) => {
      const row = resultRows.find((r) => r.athlete_id === id);
      const athlete = row?.athletes ?? (missingAthletes ?? []).find((a: any) => a.id === id);
      return {
        key: id,
        name: shortName(athlete),
        nationCode: athlete?.nation_code ?? "",
        rank: row?.rank ?? null,
        points: pickPoints[id],
        caFarte: id === caFarteTargetId,
        fusee: row?.is_fusee ?? false,
        gachette: row?.is_gachette ?? false,
        shootings: row?.shootings ?? null,
      };
    });
    // Ordre d'arrivée, les non classés à la fin (comme VéloPronos).
    picks.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    extras = computeIndividualExtras(breakdown);
  }

  return {
    ...base,
    prediction: {
      points,
      picks,
      multiplier: multiplierKind && multiplierGain !== 0 ? { kind: multiplierKind, gain: multiplierGain } : null,
      extras,
      bonusX2: prediction.bonus_x2_used,
      card: prediction.bonus_card_used ?? null,
      playerRank: ledger ? (betterCount ?? 0) + 1 : null,
      playerCount: playerCount ?? 0,
    },
  };
}
