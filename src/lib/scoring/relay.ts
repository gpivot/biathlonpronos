import { RELAY_RANK_MULTIPLIERS } from "./constants";

export interface NationRaceResult {
  nationCode: string;
  rank: number;
}

export interface RelayScoringInput {
  predictedNationCode: string;
  results: NationRaceResult[];
  oddsByNationCode: Record<string, number>;
  /** 2 si Mondiaux/JO, sinon 1. */
  stageCoefficient: 1 | 2;
  /** Bonus ×2 personnel de saison (§7 : utilisable sur un relais aussi). Ignoré si stageCoefficient === 2. */
  bonusX2Active: boolean;
}

export interface RelayScoringResult {
  total: number;
  breakdown: { base: number };
}

/**
 * §5 — relais : cote × multiplicateur de rang, seules les 5 premières
 * nations marquent. Pas de bonus de combinaison (un seul choix, une
 * nation) ni de malus de course spéciale (non mentionnés pour les relais
 * dans le règlement) — à confirmer par Guillaume si un besoin apparaît.
 */
export function computeRelayScore(input: RelayScoringInput): RelayScoringResult {
  const result = input.results.find((r) => r.nationCode === input.predictedNationCode);
  const rank = result?.rank;
  const odds = input.oddsByNationCode[input.predictedNationCode] ?? 0;

  const base = rank != null && rank <= 5 ? RELAY_RANK_MULTIPLIERS[rank] * odds : 0;
  const multiplier = input.stageCoefficient === 2 ? 2 : input.bonusX2Active ? 2 : 1;

  return { total: base * multiplier, breakdown: { base } };
}
