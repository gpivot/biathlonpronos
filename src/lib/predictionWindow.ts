import { addDays, parisDay } from "./weekStage";

/**
 * Les pronostics d'une étape (liste des biathlètes et cotes) n'ouvrent que 7 jours avant son
 * premier jour : Guillaume met à jour le CSV des cotes pendant les pauses du calendrier.
 */
export const PREDICTION_OPENING_DAYS = 7;

/** Jour (Paris, "2027-01-02") où les pronostics de l'étape ouvrent. */
export function predictionOpensOn(stageStartsOn: string): string {
  return addDays(stageStartsOn.slice(0, 10), -PREDICTION_OPENING_DAYS);
}

/** Les pronostics de l'étape sont-ils ouverts à cet instant ? */
export function isPredictionOpen(stageStartsOn: string, now: Date): boolean {
  return parisDay(now) >= predictionOpensOn(stageStartsOn);
}
