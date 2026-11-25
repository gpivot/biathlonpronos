/**
 * Règles d'envoi des notifications, sans accès à la base (testées dans __tests__/notifications).
 */

/** Le rappel part quand la course démarre dans 2 h ou moins. */
export const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * Pas de notification « résultats » pour une course vieille de plus de 3 jours : saisir les
 * résultats d'une course passée (tests, corrections tardives) ne doit pas réveiller les joueurs.
 */
export const RESULTS_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface ReminderRace {
  id: string;
  locks_at: string;
}

/**
 * Courses à rappeler pour chaque joueur : celles qui démarrent dans les 2 h, qu'il n'a pas
 * pronostiquées et pour lesquelles ce canal ne lui a pas déjà envoyé de rappel.
 * `predicted` et `alreadySent` contiennent des clés « raceId:userId ».
 */
export function planReminders(
  races: ReminderRace[],
  userIds: string[],
  predicted: Set<string>,
  alreadySent: Set<string>
): Map<string, ReminderRace[]> {
  const plan = new Map<string, ReminderRace[]>();
  const sorted = [...races].sort((a, b) => a.locks_at.localeCompare(b.locks_at));
  for (const userId of userIds) {
    const due = sorted.filter((race) => !predicted.has(`${race.id}:${userId}`) && !alreadySent.has(`${race.id}:${userId}`));
    if (due.length > 0) plan.set(userId, due);
  }
  return plan;
}

export function isReminderWindow(locksAt: string, now: Date): boolean {
  const start = new Date(locksAt).getTime();
  return start > now.getTime() && start - now.getTime() <= REMINDER_LEAD_MS;
}

export function areResultsFresh(locksAt: string, now: Date): boolean {
  return now.getTime() - new Date(locksAt).getTime() <= RESULTS_MAX_AGE_MS;
}

const parisParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * Le récap e-mail de la semaine part le lundi matin (heure de Paris), entre 8 h et midi : l'envoi
 * est vérifié tous les quarts d'heure, la trace des envois évite les doublons.
 * Renvoie la référence du récap (« 2026-11-09 », le lundi d'envoi) ou null hors de ce créneau.
 */
export function weeklyRecapRef(now: Date): string | null {
  const parts = Object.fromEntries(parisParts.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  if (parts.weekday !== "Mon" || hour < 8 || hour >= 12) return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Somme des points d'un joueur sur ses lignes de classement, arrondie à l'entier. */
export function sumPoints(rows: { points: number | string }[]): number {
  return Math.round(rows.reduce((total, row) => total + Number(row.points), 0));
}

/**
 * Choix d'un pronostic absents de la liste de départ enregistrée (biathlètes, ou nation d'un
 * relais). Liste vide (aucune liste enregistrée) : rien n'est signalé, tout le monde est proposé.
 * Renvoie, par joueur, les choix concernés (triés, sans doublon).
 */
export function offStartPicks(
  predictions: { user_id: string; picks: (string | null | undefined)[] }[],
  startIds: Iterable<string>
): Map<string, string[]> {
  const inList = new Set(startIds);
  const result = new Map<string, string[]>();
  if (inList.size === 0) return result;
  for (const p of predictions) {
    const missing = [...new Set(p.picks.filter((id): id is string => Boolean(id) && !inList.has(id as string)))].sort();
    if (missing.length > 0) result.set(p.user_id, missing);
  }
  return result;
}
