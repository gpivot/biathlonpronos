import type { SupabaseClient } from "@supabase/supabase-js";
import { FUSEE_BONUS, GACHETTE_BONUS } from "./scoring/constants";

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
}

export interface LastResultExtra {
  /** Clé de traduction (Home.lastResultExtra_<kind>). */
  kind: "combination" | "pronoParfait" | "specialMalus" | "aspiration" | "pepite";
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
  /** null : le joueur n'avait pas pronostiqué cette course. */
  prediction: {
    points: number;
    picks: LastResultPick[];
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

/** Bonus et malus de course qui ne sont rattachés à aucun athlète en particulier. */
export function computeIndividualExtras(breakdown: IndividualBreakdown): LastResultExtra[] {
  const extras: LastResultExtra[] = [
    { kind: "combination", points: breakdown.combinationBonus ?? 0 },
    { kind: "pronoParfait", points: breakdown.pronoParfaitBonus ?? 0 },
    { kind: "specialMalus", points: breakdown.specialMalus ?? 0 },
    { kind: "aspiration", points: breakdown.aspirationBonus ?? 0 },
    { kind: "pepite", points: breakdown.pepiteBonus ?? 0 },
  ];
  return extras.filter((e) => e.points !== 0);
}

/**
 * Charge la dernière course notée (statut « finished ») dont l'heure de
 * verrouillage est passée selon l'horloge `now` (horloge simulée de l'admin).
 */
export async function getLastResult(
  supabase: SupabaseClient,
  seasonId: string,
  userId: string,
  now: Date
): Promise<LastResult | null> {
  const { data: race } = await supabase
    .from("races")
    .select("id, format, sex, locks_at, stages!inner(location, country_code, coefficient, season_id)")
    .eq("stages.season_id", seasonId)
    .eq("status", "finished")
    .lte("locks_at", now.toISOString())
    .order("locks_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!race) return null;
  const stage = race.stages as any as { location: string; country_code: string; coefficient: number };

  const [{ data: results }, { data: prediction }, { data: ledger }] = await Promise.all([
    supabase
      .from("race_results")
      .select("rank, athlete_id, nation_code, is_fusee, is_gachette, athletes(first_name, last_name, nation_code), nations(name)")
      .eq("race_id", race.id)
      .order("rank", { ascending: true }),
    supabase
      .from("predictions")
      .select("athlete_ids, nation_code, bonus_x2_used, bonus_card_used, bonus_card_target_athlete_id")
      .eq("user_id", userId)
      .eq("race_id", race.id)
      .maybeSingle(),
    supabase.from("score_ledger").select("points, breakdown").eq("user_id", userId).eq("race_id", race.id).maybeSingle(),
  ]);

  const resultRows = (results ?? []) as any[];
  const shortName = (a: { first_name?: string; last_name?: string } | null | undefined) =>
    a ? `${a.first_name ? `${a.first_name[0]}. ` : ""}${a.last_name ?? ""}` : "";
  const rowName = (r: any) => (r.athlete_id ? shortName(r.athletes) : r.nations?.name ?? r.nation_code);
  const rowNation = (r: any) => (r.athlete_id ? r.athletes?.nation_code ?? "" : r.nation_code);

  const podium = resultRows
    .filter((r) => r.rank <= 3)
    .map((r) => ({ rank: r.rank as number, name: rowName(r), nationCode: rowNation(r) }));

  const base: Omit<LastResult, "prediction"> = {
    raceId: race.id,
    format: race.format,
    sex: race.sex,
    locksAt: race.locks_at,
    location: stage.location,
    countryCode: stage.country_code,
    coefficient: stage.coefficient,
    podium,
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

  if (prediction.nation_code) {
    const row = resultRows.find((r) => r.nation_code === prediction.nation_code);
    let name = row ? rowName(row) : prediction.nation_code;
    if (!row) {
      const { data: nation } = await supabase.from("nations").select("name").eq("code", prediction.nation_code).maybeSingle();
      name = nation?.name ?? prediction.nation_code;
    }
    picks = [
      { key: prediction.nation_code, name, nationCode: prediction.nation_code, rank: row?.rank ?? null, points, caFarte: false },
    ];
  } else {
    const athleteIds: string[] = prediction.athlete_ids ?? [];
    const caFarteTargetId =
      prediction.bonus_card_used === "ca_farte" ? prediction.bonus_card_target_athlete_id ?? null : null;
    const pickPoints = computeIndividualPickPoints({
      athleteIds,
      breakdown,
      results: resultRows,
      stageCoefficient: stage.coefficient,
      bonusX2: prediction.bonus_x2_used,
      caFarteTargetId,
    });

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
      extras,
      bonusX2: prediction.bonus_x2_used,
      card: prediction.bonus_card_used ?? null,
      playerRank: ledger ? (betterCount ?? 0) + 1 : null,
      playerCount: playerCount ?? 0,
    },
  };
}
