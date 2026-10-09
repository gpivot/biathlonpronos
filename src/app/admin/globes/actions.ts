"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { scoreSeasonPredictionCategory } from "@/lib/admin/seasonScoring";
import type { SeasonPredictionCategory } from "@/lib/scoring";

export async function saveGlobeRanking(formData: FormData): Promise<{ message: string }> {
  const admin = createAdminClient();
  const seasonId = String(formData.get("season_id"));
  const category = String(formData.get("category")) as SeasonPredictionCategory;

  const rankedIds = [1, 2, 3, 4, 5]
    .map((rank) => String(formData.get(`rank_${rank}`) ?? "").trim())
    .filter(Boolean);

  const result = await scoreSeasonPredictionCategory(admin, seasonId, category, rankedIds);
  return { message: `${result.scoredPredictions} pronostic(s) noté(s) pour cette catégorie.` };
}
