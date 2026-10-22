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
