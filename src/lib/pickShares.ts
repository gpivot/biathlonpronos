/**
 * « % des joueurs » : part des joueurs ayant pronostiqué chaque biathlète (ou nation en relais)
 * sur une course, recalculée à chaque affichage de la page, donc à jour après chaque nouveau prono.
 *
 * Avant le départ, les pronostics des autres restent cachés (RLS, migration 0018) : seuls des
 * totaux sortent du serveur, jamais le pronostic d'un joueur, et seulement à partir de
 * PICK_SHARE_MIN_PLAYERS joueurs pour qu'un pourcentage ne trahisse pas un pronostic
 * (choix de Guillaume, 26/11/2026). Après le départ, affichés quel que soit le nombre de joueurs.
 */
export const PICK_SHARE_MIN_PLAYERS = 20;

export type PickShares = {
  /** Nombre de joueurs ayant un pronostic valide sur la course. */
  total: number;
  /** Pourcentage arrondi (0–100) par athlete_id ou nation_code. */
  shares: Record<string, number>;
};

/** Calcul pur : chaque joueur compte une fois par biathlète choisi (somme > 100 % en individuel). */
export function computePickShares(rows: { athlete_ids?: string[] | null; nation_code?: string | null }[]): PickShares {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const keys = new Set<string>(row.nation_code ? [row.nation_code] : (row.athlete_ids ?? []).filter(Boolean));
    if (keys.size === 0) continue;
    total += 1;
    keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  }
  const shares: Record<string, number> = {};
  counts.forEach((count, key) => {
    shares[key] = Math.round((count / total) * 100);
  });
  return { total, shares };
}

/** Pourcentages visibles ou non : toujours après le départ, avant seulement au-delà du seuil. */
export function pickSharesVisible(total: number, locked: boolean): boolean {
  if (total === 0) return false;
  return locked || total >= PICK_SHARE_MIN_PLAYERS;
}

