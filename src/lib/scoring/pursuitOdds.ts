import { PURSUIT_ODDS } from "./constants";

/**
 * §4 — cote poursuite = cote de base + 5 par tranche de 20s de retard sur le
 * vainqueur du sprint, 1ère tranche neutre, plafonnée à 50 (haut de l'échelle des cotes course,
 * novembre 2026). Le plafond ne fait jamais baisser une cote de base déjà au-dessus.
 * Exemples règlement (base 10) : 12s → 10, 42s → 20, 1'10 → 25.
 */
export function computePursuitOdds(baseOdds: number, gapSeconds: number): number {
  const increment = Math.floor(gapSeconds / PURSUIT_ODDS.stepSeconds) * PURSUIT_ODDS.incrementPerStep;
  return Math.max(baseOdds, Math.min(baseOdds + increment, PURSUIT_ODDS.cap));
}
