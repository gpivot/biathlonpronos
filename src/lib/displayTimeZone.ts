/**
 * Fuseau d'affichage des dates et heures côté joueur. Sans lui, les pages
 * rendues côté serveur (Vercel tourne en UTC) et les composants client (fuseau
 * du navigateur) affichaient des heures différentes pour une même course.
 */
export const DISPLAY_TIME_ZONE = "Europe/Paris";

const wallClockFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Heure de Paris d'un instant, au format d'un input datetime-local ("2026-11-29T13:15"). */
export function toParisWallTime(date: Date): string {
  const parts = Object.fromEntries(wallClockFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Instant correspondant à une heure de Paris ("2026-11-29T13:15"), heure d'été comprise. */
export function fromParisWallTime(wallTime: string): Date {
  const asUtc = new Date(`${wallTime}:00Z`).getTime();
  // Écart Paris/UTC à cet instant, recalculé une fois pour les changements d'heure.
  let instant = asUtc;
  for (let i = 0; i < 2; i++) {
    const offset = new Date(`${toParisWallTime(new Date(instant))}:00Z`).getTime() - instant;
    instant = asUtc - offset;
  }
  return new Date(instant);
}
