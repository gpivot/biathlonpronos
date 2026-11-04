/** Texte comparable : minuscules, sans accents (« Bø » → « bo », « Öberg » → « oberg »). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .trim();
}

/**
 * Filtre de saisie des pronostics, par nom ou code pays à 3 lettres (FRA, NOR…).
 * Chaque mot tapé doit se retrouver dans l'un des champs (`fields`). Un mot qui est exactement un
 * code pays présent dans la liste ne garde que ce pays : « fra » donne les Français, pas
 * Franziska Preuss. Recherche vide : tout passe.
 */
export function filterBySearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => (string | null | undefined)[],
  nationCode: (item: T) => string | null | undefined,
): T[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  const codes = new Set(
    items.map((i) => normalizeSearch(nationCode(i) ?? "")).filter(Boolean),
  );
  return items.filter((item) => {
    const code = normalizeSearch(nationCode(item) ?? "");
    const haystack = fields(item)
      .filter(Boolean)
      .map((f) => normalizeSearch(f as string));
    return words.every((w) =>
      codes.has(w) ? code === w : haystack.some((f) => f.includes(w)),
    );
  });
}
