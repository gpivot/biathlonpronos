/**
 * Fautes au tir, tir par tir (ex. [0, 1, 0, 2] pour une poursuite). Affichées en ronds noirs à
 * côté de chaque athlète, comme sur biathlonworld, et somme utilisée comme nombre de tours de
 * pénalité pour la course « Tour de péna ».
 */

const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

/** Nombre de tirs affichés : 2 au sprint et en relais (couché, debout), 4 sinon. */
export function shootingCount(format: string): number {
  return format === "sprint" || RELAY_FORMATS.includes(format) ? 2 : 4;
}

/**
 * Lit les fautes par tir.
 * - « 0+1+0+2 » (format IBU d'une course individuelle, aussi accepté avec espaces, « ; » ou « , »
 *   séparés par des +) : une valeur par tir.
 * - « 0+1 1+3 » (relais IBU : tours de péna + balles de pioche, un groupe par tir) : un groupe
 *   séparé par des espaces par tir, ses valeurs additionnées (chaque balle de pioche est une faute).
 * Avec `count`, les tirs en trop sont repliés tir par tir (relais : 8 tirs d'équipe → couché, debout).
 * `null` si vide ou illisible.
 */
export function parseShootings(value: string | null | undefined, count?: number): number[] | null {
  const text = (value ?? "").trim();
  if (text === "") return null;
  const normalized = text.replace(/\s*\+\s*/g, "+");
  const tokens = normalized.split(/\s+/);
  const shots =
    tokens.length > 1 && tokens.every((t) => t.includes("+"))
      ? tokens.map((t) => t.split("+").reduce((sum, n) => sum + Number(n), 0))
      : normalized.split(/[+\s;,/]+/).filter(Boolean).map(Number);
  if (shots.length === 0 || shots.some((n) => !Number.isInteger(n) || n < 0 || n > 99)) return null;
  if (count && shots.length > count && shots.length % count === 0) {
    return Array.from({ length: count }, (_, i) => shots.filter((_, j) => j % count === i).reduce((a, b) => a + b, 0));
  }
  return shots;
}

/** [0, 1, 0, 2] → « 0+1+0+2 » (CSV et saisie admin). */
export function formatShootings(shots: number[] | null | undefined): string {
  return shots && shots.length > 0 ? shots.join("+") : "";
}

export function totalMisses(shots: number[] | null | undefined): number | null {
  return shots && shots.length > 0 ? shots.reduce((a, b) => a + b, 0) : null;
}
