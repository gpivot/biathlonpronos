import { STREAK_TARGET } from "./constants";

export interface StreakUpdateResult {
  currentStreak: number;
  cardEarned: boolean;
}

/**
 * §12 — le 10/10. La série continue tant qu'au moins un des choix du joueur
 * marque des points sur la course ; une course sans le moindre point la
 * remet à zéro. À 10, une carte bonus est gagnée et le compteur repart de 0.
 */
export function updateStreak(currentStreak: number, raceTotalPoints: number): StreakUpdateResult {
  if (raceTotalPoints <= 0) {
    return { currentStreak: 0, cardEarned: false };
  }

  const next = currentStreak + 1;
  if (next >= STREAK_TARGET) {
    return { currentStreak: 0, cardEarned: true };
  }

  return { currentStreak: next, cardEarned: false };
}

export interface SeasonStreak {
  currentStreak: number;
  cardsEarned: number;
}

/**
 * Rejoue toute la saison : `raceIds` dans l'ordre chronologique, `pointsByRace` donne pour chaque
 * course les points de chaque joueur qui l'a pronostiquée (un joueur sans prono n'est pas compté,
 * comme lors de la notation). Sert à recalculer les séries après une correction de résultats.
 */
export function computeSeasonStreaks(
  raceIds: string[],
  pointsByRace: Map<string, Map<string, number>>
): Map<string, SeasonStreak> {
  const streaks = new Map<string, SeasonStreak>();
  for (const raceId of raceIds) {
    for (const [userId, points] of pointsByRace.get(raceId) ?? []) {
      const current = streaks.get(userId) ?? { currentStreak: 0, cardsEarned: 0 };
      const update = updateStreak(current.currentStreak, points);
      streaks.set(userId, {
        currentStreak: update.currentStreak,
        cardsEarned: current.cardsEarned + (update.cardEarned ? 1 : 0),
      });
    }
  }
  return streaks;
}

/**
 * Ajoute aux points de chaque course ceux des questions bonus (20 pts par bonne réponse) : ils
 * comptent pour la série et peuvent la sauver (décision de Guillaume, 27/11/2026). Un joueur sans
 * prono mais avec une bonne réponse compte comme ayant marqué sur la course (à confirmer).
 */
export function addBonusQuestionPointsToRaces(
  pointsByRace: Map<string, Map<string, number>>,
  rows: Array<{ userId: string; raceId: string | null | undefined; points: number }>
): void {
  for (const row of rows) {
    if (!row.raceId) continue;
    if (!pointsByRace.has(row.raceId)) pointsByRace.set(row.raceId, new Map());
    const byUser = pointsByRace.get(row.raceId)!;
    byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + row.points);
  }
}
