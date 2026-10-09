import { GROS_GLOBE_MULTIPLIERS, PETIT_GLOBE_MULTIPLIERS, PEPITE_MIN_ODDS, RANK_MULTIPLIERS } from "./constants";

export type SeasonPredictionCategory =
  | "gros_globe_h"
  | "gros_globe_f"
  | "meilleur_jeune_h"
  | "meilleur_jeune_f"
  | "meilleure_nation_h"
  | "meilleure_nation_f";

/**
 * §6 — globes de saison : cote × multiplicateur selon la position finale
 * (1re à 5e) du choix du joueur dans le classement officiel de fin de
 * saison saisi par l'admin. Gros globe (barème large) vs meilleur(e) jeune
 * / meilleure nation (barème réduit, podium uniquement).
 */
export function computeSeasonPredictionScore(
  category: SeasonPredictionCategory,
  finalRank: number | null,
  odds: number
): number {
  if (finalRank == null) return 0;
  const multipliers = category.startsWith("gros_globe") ? GROS_GLOBE_MULTIPLIERS : PETIT_GLOBE_MULTIPLIERS;
  return (multipliers[finalRank] ?? 0) * odds;
}

/**
 * §14 — Pépite : un outsider choisi en début de saison (cote ≥ 30 au moment
 * du choix), une par sexe. C'est un pronostic caché actif sur chaque course
 * individuelle jusqu'à son premier Top 10 de la saison : à ce moment-là, son
 * score sur cette course (cote × multiplicateur de rang, même barème qu'un
 * pronostic normal, §1) s'ajoute en bonus au score du joueur. Ensuite, elle
 * redevient un athlète comme un autre — plus de bonus automatique sur les
 * courses suivantes (confirmé par Guillaume).
 */
export function isPepiteEligible(oddsAtPick: number): boolean {
  return oddsAtPick >= PEPITE_MIN_ODDS;
}

export function computePepiteBonus(oddsAtRace: number, rank: number): number {
  if (rank > 10) return 0;
  return (RANK_MULTIPLIERS[rank] ?? 0) * oddsAtRace;
}
