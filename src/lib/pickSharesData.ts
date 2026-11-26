import { createAdminClient } from "@/lib/supabase/server";
import { computePickShares, pickSharesVisible, type PickShares } from "@/lib/pickShares";

/**
 * Lecture de tous les pronostics de la course avec la clé service_role (contourne RLS) : côté
 * serveur uniquement, et seuls les totaux sont renvoyés (`shares` vide tant qu'ils ne sont pas visibles).
 */
export async function getPickShares(raceId: string, locked: boolean): Promise<(PickShares & { visible: boolean }) | null> {
  const admin = createAdminClient();
  const rows: { athlete_ids: string[] | null; nation_code: string | null }[] = [];
  // Supabase renvoie au plus 1 000 lignes par requête : lecture par pages.
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("predictions")
      .select("athlete_ids, nation_code")
      .eq("race_id", raceId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const result = computePickShares(rows);
  const visible = pickSharesVisible(result.total, locked);
  return { total: result.total, shares: visible ? result.shares : {}, visible };
}
