import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSeasonPredictionScore, type SeasonPredictionCategory } from "@/lib/scoring";

/**
 * §6 — écrit le classement final officiel d'une catégorie de globe (jusqu'à
 * 5 rangs) et note chaque pronostic déposé sur cette catégorie.
 */
export async function scoreSeasonPredictionCategory(
  admin: SupabaseClient,
  seasonId: string,
  category: SeasonPredictionCategory,
  rankedIds: string[]
): Promise<{ scoredPredictions: number }> {
  const isNation = category.startsWith("meilleure_nation");

  const { data: predictions } = await admin
    .from("season_predictions")
    .select("user_id, athlete_id, nation_code")
    .eq("season_id", seasonId)
    .eq("category", category);

  if (!predictions || predictions.length === 0) return { scoredPredictions: 0 };

  const pickedIds = predictions.map((p) => (isNation ? p.nation_code : p.athlete_id)).filter(Boolean) as string[];

  const format = category.startsWith("gros_globe")
    ? "gros_globe"
    : category.startsWith("meilleur_jeune")
      ? "meilleur_jeune"
      : "meilleure_nation";

  const oddsQuery = admin
    .from("odds")
    .select(isNation ? "nation_code, value" : "athlete_id, value")
    .eq("season_id", seasonId)
    .eq("format", format)
    .is("valid_until", null);

  const { data: odds } = isNation
    ? await oddsQuery.in("nation_code", pickedIds)
    : await oddsQuery.in("athlete_id", pickedIds);

  const oddsById = new Map((odds ?? []).map((o: any) => [isNation ? o.nation_code : o.athlete_id, o.value as number]));

  const scoreLedgerRows = predictions.map((prediction) => {
    const pickedId = isNation ? prediction.nation_code : prediction.athlete_id;
    const rank = pickedId ? rankedIds.indexOf(pickedId) + 1 || null : null;
    const points = computeSeasonPredictionScore(category, rank, oddsById.get(pickedId ?? "") ?? 0);

    return {
      user_id: prediction.user_id,
      season_id: seasonId,
      season_prediction_category: category,
      points,
      breakdown: { finalRank: rank },
    };
  });

  const { error } = await admin
    .from("score_ledger")
    .upsert(scoreLedgerRows, { onConflict: "user_id,season_id,season_prediction_category" });
  if (error) throw new Error(error.message);

  return { scoredPredictions: scoreLedgerRows.length };
}
