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
