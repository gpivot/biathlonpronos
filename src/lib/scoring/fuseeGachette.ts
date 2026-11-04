import { FUSEE_CARD_BONUS_BY_SKI_RANK, GACHETTE_CARD_BONUS } from "./constants";

/**
 * §15 — Fusée (temps de ski) et Gâchette (sans-faute au tir). Depuis le 04/11/2026 ce ne sont plus
 * des bonus automatiques mais des cartes bonus jouées sur une étape : elles valent sur les 4 formats
 * individuels (sprint, poursuite, individuel, mass start), jamais sur un relais.
 */
const INDIVIDUAL_FORMATS = new Set(["sprint", "poursuite", "individuel", "mass_start"]);

export function fuseeGachetteEligibility(format: string): { fusee: boolean; gachette: boolean } {
  const individual = INDIVIDUAL_FORMATS.has(format);
  return { fusee: individual, gachette: individual };
}

/** Retire la Fusée / la Gâchette d'une ligne de résultat de relais (seules les courses individuelles comptent). */
export function applyFuseeGachetteRules<
  T extends { is_fusee?: boolean | null; is_gachette?: boolean | null; ski_rank?: number | null }
>(format: string, row: T): T {
  const eligible = fuseeGachetteEligibility(format);
  return {
    ...row,
    is_fusee: eligible.fusee && (!!row.is_fusee || row.ski_rank === 1),
    is_gachette: eligible.gachette && !!row.is_gachette,
    ...(row.ski_rank !== undefined ? { ski_rank: eligible.fusee ? row.ski_rank ?? null : null } : {}),
  };
}

/** Rang au temps de ski d'une ligne de résultat : `ski_rank`, à défaut 1 si la Fusée (meilleur temps) est cochée. */
export function skiRankOf(row: { ski_rank?: number | null; is_fusee?: boolean | null }): number | null {
  if (row.ski_rank != null && row.ski_rank > 0) return row.ski_rank;
  return row.is_fusee ? 1 : null;
}

/** Points de la carte Fusée pour un biathlète : 100 / 50 / 20 pour le 1er / 2e / 3e temps de ski. */
export function fuseeCardPoints(skiRank: number | null | undefined): number {
  return skiRank != null ? FUSEE_CARD_BONUS_BY_SKI_RANK[skiRank] ?? 0 : 0;
}

/** Points de la carte Gâchette pour un biathlète sans faute au tir : 50 au sprint (10/10), 100 sinon (20/20). */
export function gachetteCardPoints(format: string, clean: boolean | null | undefined): number {
  if (!clean || !INDIVIDUAL_FORMATS.has(format)) return 0;
  return format === "sprint" ? GACHETTE_CARD_BONUS.sprint : GACHETTE_CARD_BONUS.other;
}
