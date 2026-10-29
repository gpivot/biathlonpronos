/**
 * Nom court d'un biathlète pour les lignes étroites : initiale du prénom + nom. Un nom composé
 * garde son premier nom entier et l'initiale des suivants, pour ne pas déborder
 * (« Johannes Dale-Skjevdal » → « J. Dale-S. », « Quentin Fillon Maillet » → « Q. Fillon M. »).
 */
export function shortAthleteName(a: { first_name?: string | null; last_name?: string | null } | null | undefined, fallback = "?"): string {
  if (!a) return fallback;
  const initial = a.first_name ? `${a.first_name.trim()[0]}. ` : "";
  return `${initial}${abbreviateCompoundName(a.last_name ?? "")}`;
}

export function abbreviateCompoundName(lastName: string): string {
  const match = lastName.trim().match(/^([^\s-]+)([\s-])(.+)$/);
  if (!match) return lastName.trim();
  const [, first, separator, rest] = match;
  const initials = rest
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join(separator === "-" ? "-" : " ");
  return `${first}${separator}${initials}`;
}
