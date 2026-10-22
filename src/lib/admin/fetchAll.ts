/**
 * Supabase plafonne une lecture à 1000 lignes : les cotes d'une saison (≈ 6 par athlète) dépassent
 * vite ce seuil. Lit toutes les pages d'une requête ordonnée, `build` recevant la plage à lire.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
