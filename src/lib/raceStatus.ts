import type { Race } from "./types/domain";

export type RaceDisplayStatus = "upcoming" | "ongoing" | "finished";

/**
 * Le statut affiché est dérivé (pas seulement `races.status`, qui ne passe
 * jamais à "locked" en base — aucun cron ne l'écrit) : une course est "en
 * cours" dès que l'heure de verrouillage est passée et qu'elle n'a pas
 * encore été notée par l'admin.
 */
export function getRaceDisplayStatus(race: Pick<Race, "status" | "locks_at">): RaceDisplayStatus {
  if (race.status === "finished") return "finished";
  return new Date(race.locks_at) <= new Date() ? "ongoing" : "upcoming";
}
