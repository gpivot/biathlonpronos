import { fromParisWallTime } from "./displayTimeZone";
import { addDays } from "./weekStage";

/**
 * Les pronostics d'une étape ouvrent le lundi qui la précède, à 17 h (heure de Paris), pour
 * toutes ses courses (règle du 07/11/2026, elle remplace l'ouverture à J-7). Les staffs changent
 * souvent leurs biathlètes en début de semaine : à l'ouverture, les sprints et individuels ne
 * proposent que les 60 premiers du classement général (voir startListOpening.ts), affinés ensuite
 * avec la liste de départ officielle IBU (bouton du back-office).
 *
 * « Lundi qui précède » : le lundi strictement avant le premier jour de l'étape (une étape qui
 * commence un lundi ouvre le lundi d'avant). À confirmer.
 */
export const PREDICTION_OPENING_TIME = "17:00";

/** Jour (Paris, "2027-01-04") où les pronostics de l'étape ouvrent : le lundi qui la précède. */
export function predictionOpensOn(stageStartsOn: string): string {
  const start = stageStartsOn.slice(0, 10);
  const weekday = new Date(`${start}T12:00:00Z`).getUTCDay(); // 0 = dimanche, 1 = lundi
  const daysBack = (weekday + 6) % 7 || 7;
  return addDays(start, -daysBack);
}

/** Instant exact de l'ouverture : le lundi qui précède l'étape, 17 h heure de Paris. */
export function predictionOpensAt(stageStartsOn: string): Date {
  return fromParisWallTime(`${predictionOpensOn(stageStartsOn)}T${PREDICTION_OPENING_TIME}`);
}

/** Les pronostics de l'étape sont-ils ouverts à cet instant ? */
export function isPredictionOpen(stageStartsOn: string, now: Date): boolean {
  return now.getTime() >= predictionOpensAt(stageStartsOn).getTime();
}

