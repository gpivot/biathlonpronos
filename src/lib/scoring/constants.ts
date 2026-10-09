// Barèmes chiffrés du règlement (docs/reglement.md) — une seule source de
// vérité pour toutes les valeurs numériques du moteur de scoring.

/** §1 — cote × multiplicateur, par rang. Rien au-delà de la 10e place. */
export const RANK_MULTIPLIERS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 13,
  4: 10,
  5: 7,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1,
};

/** §1 — bonus de combinaison, évalués sur l'ensemble des 3 choix comptés. */
export const COMBINATION_BONUS = {
  podium: 100,
  top5: 50,
  top10: 20,
  pronoParfait: 200,
} as const;

/** §4 — recalcul de la cote poursuite à partir de l'écart au sprint. */
export const PURSUIT_ODDS = {
  stepSeconds: 20,
  incrementPerStep: 5,
  cap: 40,
} as const;

/** §5 — relais : barème réduit, seules les 5 premières nations marquent. */
export const RELAY_RANK_MULTIPLIERS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 4,
  4: 2,
  5: 1,
};

/** §6 — pronostics de saison (globes). */
export const GROS_GLOBE_MULTIPLIERS: Record<number, number> = {
  1: 10,
  2: 5,
  3: 3,
  4: 2,
  5: 1,
};

export const PETIT_GLOBE_MULTIPLIERS: Record<number, number> = {
  1: 5,
  2: 2,
  3: 1,
};

/** §9 — courses spéciales. */
export const TOUR_DE_PENA_MALUS_PER_LAP = -20;

export const TES_COLLE_MALUS = {
  oneOutOfTop10: -30,
  twoOutOfTop10: -100,
  threeOutOfTop10: -300,
  noBetOrIncomplete: -200,
} as const;

/** §11 — bonus Aspiration, calculé sur la performance collective réelle. */
export const ASPIRATION_BONUS_BY_COUNT: Record<number, number> = {
  2: 20,
  3: 50,
  4: 100, // et au-delà
};

/** §12 — série de courses consécutives où au moins un choix marque des points. */
export const STREAK_TARGET = 10;

/** §15 — Fusée (meilleur ski) et Gâchette (sans-faute au tir). */
export const FUSEE_BONUS = 50;
export const GACHETTE_BONUS = 20;

/** §14 — cote minimale pour être éligible comme Pépite. */
export const PEPITE_MIN_ODDS = 30;
