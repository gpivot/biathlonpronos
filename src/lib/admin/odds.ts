import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remplace la cote courante d'un athlète (ou d'une nation, pour "meilleure
 * nation") pour un format donné : expire l'éventuelle ligne courante puis
 * insère la nouvelle, pour conserver l'historique (odds.valid_from/until).
 */
export async function setCurrentOdds(
  admin: SupabaseClient,
  params: {
    seasonId: string;
    format: string;
    value: number;
    athleteId?: string;
    nationCode?: string;
    nationSex?: string;
  }
): Promise<void> {
  const { seasonId, format, value, athleteId, nationCode, nationSex } = params;

  let expireQuery = admin
    .from("odds")
    .update({ valid_until: new Date().toISOString() })
    .eq("season_id", seasonId)
    .eq("format", format)
    .is("valid_until", null);

  expireQuery = athleteId
    ? expireQuery.eq("athlete_id", athleteId)
    : expireQuery.eq("nation_code", nationCode!).eq("nation_sex", nationSex!);

  const { error: expireError } = await expireQuery;
  if (expireError) throw new Error(expireError.message);

  const { error: insertError } = await admin.from("odds").insert({
    season_id: seasonId,
    format,
    value,
    athlete_id: athleteId ?? null,
    nation_code: athleteId ? null : nationCode,
    nation_sex: athleteId ? null : nationSex,
  });
  if (insertError) throw new Error(insertError.message);
}
