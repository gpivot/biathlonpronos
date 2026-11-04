/**
 * Pictos de profil proposés aux joueurs (migration 0038, colonne profiles.avatar). Ajouter ou
 * retirer un picto ici suffit : la base n'en garde que le texte. Un picto retiré reste affiché
 * chez ceux qui l'avaient déjà choisi.
 */
export const AVATARS = [
  "🎯", "⛷️", "🎿", "🏂", "❄️", "☃️", "🏔️", "🌲",
  "🦊", "🐺", "🐻", "🦌", "🐧", "🦉", "🐿️", "🐻‍❄️",
  "🔥", "⭐", "🏆", "🥇", "💪", "🚀", "😎", "🍀",
] as const;

export function isAvatar(value: unknown): value is (typeof AVATARS)[number] {
  return typeof value === "string" && (AVATARS as readonly string[]).includes(value);
}
