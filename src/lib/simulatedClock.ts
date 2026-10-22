/**
 * Horloge simulée (back-office) : un admin peut décaler « maintenant » pour
 * voir l'app comme à une autre date (ouverture/fermeture des pronos, « En ce
 * moment », « Prochainement »…). Le décalage est stocké dans un cookie du
 * navigateur de l'admin, en millisecondes par rapport à l'heure réelle : la
 * pendule continue donc d'avancer à partir de l'instant choisi.
 *
 * Purement visuel : la base (RLS, `now()` Postgres) reste sur l'heure réelle,
 * et le cookie n'est honoré côté serveur que pour un profil is_admin.
 */
export const SIMULATED_CLOCK_COOKIE = "bp_sim_offset";

/** Garde-fou : au-delà de ±2 ans, la valeur est considérée comme corrompue. */
const MAX_OFFSET_MS = 2 * 366 * 24 * 60 * 60 * 1000;

export function parseClockOffset(value: string | undefined | null): number | null {
  if (!value || !/^-?\d+$/.test(value)) return null;
  const offset = Number(value);
  if (!Number.isSafeInteger(offset) || offset === 0 || Math.abs(offset) > MAX_OFFSET_MS) return null;
  return offset;
}

export function applyClockOffset(offset: number | null, realNow: Date = new Date()): Date {
  return offset === null ? realNow : new Date(realNow.getTime() + offset);
}
