/**
 * §15 — formats éligibles : la Fusée (meilleur temps de ski) ne compte qu'au
 * sprint et à l'individuel, la Gâchette (20/20 au tir) qu'à la poursuite et à
 * la mass start. Appliqué à la lecture des résultats (calcul des points et
 * affichage) et à leur saisie, pour qu'une case cochée par erreur ou importée
 * de l'IBU sur un autre format ne rapporte rien.
 */
const FUSEE_FORMATS = new Set(["sprint", "individuel"]);
const GACHETTE_FORMATS = new Set(["poursuite", "mass_start"]);

export function fuseeGachetteEligibility(format: string): { fusee: boolean; gachette: boolean } {
  return { fusee: FUSEE_FORMATS.has(format), gachette: GACHETTE_FORMATS.has(format) };
}

/** Retire la Fusée / la Gâchette d'une ligne de résultat quand le format de la course ne les prévoit pas. */
export function applyFuseeGachetteRules<T extends { is_fusee?: boolean | null; is_gachette?: boolean | null }>(
  format: string,
  row: T
): T {
  const eligible = fuseeGachetteEligibility(format);
  return { ...row, is_fusee: eligible.fusee && !!row.is_fusee, is_gachette: eligible.gachette && !!row.is_gachette };
}
