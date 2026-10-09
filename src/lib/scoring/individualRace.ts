import {
  ASPIRATION_BONUS_BY_COUNT,
  COMBINATION_BONUS,
  FUSEE_BONUS,
  GACHETTE_BONUS,
  RANK_MULTIPLIERS,
  TES_COLLE_MALUS,
  TOUR_DE_PENA_MALUS_PER_LAP,
} from "./constants";
import type {
  AthleteRaceResult,
  FavoriteTeam,
  IndividualRaceScoringInput,
  IndividualRaceScoringResult,
  Sex,
} from "./types";

/**
 * Moteur de scoring d'une course individuelle (sprint/poursuite/individuel/
 * mass start) pour le pronostic d'un joueur. Suit la séquence documentée
 * dans docs/architecture-technique.md (§ Moteur de scoring). Le règlement
 * (docs/reglement.md) laisse plusieurs points d'interprétation ouverts ;
 * les choix retenus ici sont documentés dans architecture-technique.md
 * (§ Décisions d'implémentation du moteur de scoring, confirmées par
 * Guillaume).
 */
export function computeIndividualRaceScore(
  input: IndividualRaceScoringInput
): IndividualRaceScoringResult {
  const resultsByAthleteId = new Map(input.results.map((r) => [r.athleteId, r]));

  // 2. Points de base par athlète pronostiqué (cote × rang), + malus
  // "tour de péna" qui est propre à chacun des biathlètes choisis.
  const base: Record<string, number> = {};
  for (const athleteId of input.predictedAthleteIds) {
    base[athleteId] = computeBaseAthletePoints(
      resultsByAthleteId.get(athleteId),
      input.oddsByAthleteId[athleteId] ?? 0,
      input.specialRule
    );
  }

  // Bonus Fusée/Gâchette attribués par athlète (confirmé par Guillaume :
  // le "3 meilleurs sur 4" de la Balle de pioche s'applique après ce bonus,
  // et le doublement Team Nation doit pouvoir en tenir compte).
  const fuseeGachetteByAthlete: Record<string, number> = {};
  for (const athleteId of input.predictedAthleteIds) {
    fuseeGachetteByAthlete[athleteId] = computeAthleteFuseeGachetteBonus(resultsByAthleteId.get(athleteId));
  }

  const rawScore: Record<string, number> = {};
  for (const athleteId of input.predictedAthleteIds) {
    rawScore[athleteId] = base[athleteId] + fuseeGachetteByAthlete[athleteId];
  }

  // 5b. Carte "Balle de pioche" — 4 choix, seuls les 3 meilleurs comptent.
  const { counted, dropped } = selectCountedAthletes(input.predictedAthleteIds, rawScore, input.card);

  // 6. Coefficient ×2 Mondiaux/JO, non cumulable avec le bonus ×2 personnel.
  const globalMultiplier = input.stageCoefficient === 2 ? 2 : input.bonusX2Active ? 2 : 1;

  // 5a. Carte "Ça farte" (×3) et 7. Bonus Team Nation (×2). Confirmé par
  // Guillaume : le ×3 n'est jamais cumulable avec un ×2 — l'athlète ciblé
  // par "Ça farte" ne reçoit ni le coefficient/bonus perso, ni Team Nation.
  const perAthlete: Record<string, number> = {};
  const teamNationBoostedAthleteIds: string[] = [];
  for (const athleteId of counted) {
    const isCaFarteTarget = input.card.type === "ca_farte" && input.card.targetAthleteId === athleteId;

    if (isCaFarteTarget) {
      perAthlete[athleteId] = rawScore[athleteId] * 3;
      continue;
    }

    let value = rawScore[athleteId] * globalMultiplier;
    if (isEligibleForTeamNationBonus(athleteId, input.athleteTeamByAthleteId, input.favoriteTeam, input.raceCountryCode)) {
      value *= 2;
      teamNationBoostedAthleteIds.push(athleteId);
    }
    perAthlete[athleteId] = value;
  }

  // 3. Bonus de combinaison (podium/top5/top10, non cumulables entre eux —
  // seul le meilleur palier atteint est payé), sur les athlètes comptés.
  const combinationBonus = computeCombinationBonus(counted, resultsByAthleteId);

  // Prono parfait : comparé aux 3 athlètes effectivement comptés (donc,
  // avec la Balle de pioche, aux 3 meilleurs des 4 choix — confirmé par
  // Guillaume, puisque ce seront de fait les 3 qui comptent pour l'étape).
  const pronoParfaitBonus = computePronoParfaitBonus(counted, input.results, input.oddsByAthleteId);

  // 4. Malus "t'es collé(e)" — lu sur l'ensemble du pronostic, pas par
  // athlète ("tour de péna" et "brouillard" sont déjà inclus au point 2).
  const specialMalus =
    input.specialRule === "tes_colle"
      ? computeTesColleMalus(input.predictedAthleteIds, resultsByAthleteId)
      : 0;

  const fuseeGachetteBonus = counted.reduce((sum, id) => sum + fuseeGachetteByAthlete[id], 0);

  const total =
    Object.values(perAthlete).reduce((sum, v) => sum + v, 0) +
    combinationBonus +
    pronoParfaitBonus +
    specialMalus;

  return {
    total,
    perAthlete,
    breakdown: {
      base,
      combinationBonus,
      pronoParfaitBonus,
      specialMalus,
      fuseeGachetteBonus,
      droppedByBalleDePioche: dropped,
      teamNationBoostedAthleteIds,
    },
  };
}

function computeBaseAthletePoints(
  result: AthleteRaceResult | undefined,
  odds: number,
  specialRule: IndividualRaceScoringInput["specialRule"]
): number {
  const rank = result?.rank;
  let points = 0;

  if (rank != null && rank <= 10) {
    points = RANK_MULTIPLIERS[rank] * odds;
  } else if (specialRule === "brouillard" && rank != null) {
    // §9 — hors Top 10 sous "brouillard" : -1 pt par place au-delà de la 10e.
    points = -rank;
  }

  if (specialRule === "tour_de_pena") {
    points += (result?.penaltyLaps ?? 0) * TOUR_DE_PENA_MALUS_PER_LAP;
  }

  return points;
}

/** §15 — Fusée (une fois) et Gâchette (cumulable), attribués à l'athlète concerné. */
function computeAthleteFuseeGachetteBonus(result: AthleteRaceResult | undefined): number {
  if (!result) return 0;
  return (result.isFusee ? FUSEE_BONUS : 0) + (result.isGachette ? GACHETTE_BONUS : 0);
}

function selectCountedAthletes(
  predictedAthleteIds: string[],
  rawScore: Record<string, number>,
  card: IndividualRaceScoringInput["card"]
): { counted: string[]; dropped: string[] } {
  if (card.type !== "balle_de_pioche" || predictedAthleteIds.length <= 3) {
    return { counted: predictedAthleteIds, dropped: [] };
  }

  const sorted = [...predictedAthleteIds].sort((a, b) => rawScore[b] - rawScore[a]);
  return { counted: sorted.slice(0, 3), dropped: sorted.slice(3) };
}

function isEligibleForTeamNationBonus(
  athleteId: string,
  athleteTeamByAthleteId: Record<string, { nationCode: string; sex: Sex }>,
  favoriteTeam: FavoriteTeam | null,
  raceCountryCode: string
): boolean {
  if (!favoriteTeam || favoriteTeam.nationCode !== raceCountryCode) return false;
  const team = athleteTeamByAthleteId[athleteId];
  return team?.nationCode === favoriteTeam.nationCode && team?.sex === favoriteTeam.sex;
}

function computeCombinationBonus(
  counted: string[],
  resultsByAthleteId: Map<string, AthleteRaceResult>
): number {
  // §1 — bonus évalués "sur l'ensemble des 3 choix" : jamais pour un
  // pronostic incomplet (moins de 3 comptés, cf. malus "t'es collé(e)").
  if (counted.length !== 3) return 0;

  const ranks = counted.map((id) => resultsByAthleteId.get(id)?.rank);
  if (ranks.some((r) => r == null)) return 0;

  // Non cumulables entre eux : seul le meilleur palier atteint est payé.
  const worstRank = Math.max(...(ranks as number[]));
  if (worstRank <= 3) return COMBINATION_BONUS.podium;
  if (worstRank <= 5) return COMBINATION_BONUS.top5;
  if (worstRank <= 10) return COMBINATION_BONUS.top10;
  return 0;
}

function computeAthletePotentialScore(result: AthleteRaceResult, odds: number): number {
  if (result.rank > 10) return -Infinity;
  return (
    RANK_MULTIPLIERS[result.rank] * odds +
    (result.isFusee ? FUSEE_BONUS : 0) +
    (result.isGachette ? GACHETTE_BONUS : 0)
  );
}

/** La combinaison des 3 athlètes qui rapportent objectivement le plus de points dans le Top 10. */
function computeBestPossibleTrio(
  results: AthleteRaceResult[],
  oddsByAthleteId: Record<string, number>
): Set<string> {
  const scored = results
    .map((r) => ({ athleteId: r.athleteId, score: computeAthletePotentialScore(r, oddsByAthleteId[r.athleteId] ?? 0) }))
    .filter((s) => s.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return new Set(scored.map((s) => s.athleteId));
}

function computePronoParfaitBonus(
  counted: string[],
  results: AthleteRaceResult[],
  oddsByAthleteId: Record<string, number>
): number {
  if (counted.length !== 3) return 0;

  const bestTrio = computeBestPossibleTrio(results, oddsByAthleteId);
  if (bestTrio.size !== 3) return 0;

  const matches = counted.every((id) => bestTrio.has(id));
  return matches ? COMBINATION_BONUS.pronoParfait : 0;
}

function computeTesColleMalus(
  predictedAthleteIds: string[],
  resultsByAthleteId: Map<string, AthleteRaceResult>
): number {
  if (predictedAthleteIds.length === 0) return TES_COLLE_MALUS.noBetOrIncomplete;

  let outsideTop10Count = 0;
  for (let slot = 0; slot < 3; slot++) {
    const athleteId = predictedAthleteIds[slot];
    const rank = athleteId ? resultsByAthleteId.get(athleteId)?.rank : undefined;
    if (!athleteId || rank == null || rank > 10) outsideTop10Count++;
  }

  if (outsideTop10Count === 1) return TES_COLLE_MALUS.oneOutOfTop10;
  if (outsideTop10Count === 2) return TES_COLLE_MALUS.twoOutOfTop10;
  if (outsideTop10Count === 3) return TES_COLLE_MALUS.threeOutOfTop10;
  return 0;
}

/**
 * §11 — bonus Aspiration : indépendant du pronostic du joueur, à partir du
 * nombre d'athlètes de sa nation/sexe favori(te) classés Top 10 sur la course.
 */
export function computeAspirationBonus(
  results: AthleteRaceResult[],
  athleteTeamByAthleteId: Record<string, { nationCode: string; sex: Sex }>,
  favoriteTeam: FavoriteTeam | null
): number {
  if (!favoriteTeam) return 0;

  const count = results.filter((r) => {
    if (r.rank > 10) return false;
    const team = athleteTeamByAthleteId[r.athleteId];
    return team?.nationCode === favoriteTeam.nationCode && team?.sex === favoriteTeam.sex;
  }).length;

  if (count < 2) return 0;
  return ASPIRATION_BONUS_BY_COUNT[count] ?? ASPIRATION_BONUS_BY_COUNT[4];
}
