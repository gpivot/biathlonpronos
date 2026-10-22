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

  await clearCurrentOdds(admin, { seasonId, format, athleteId, nationCode, nationSex });

  const { error: insertError } = await admin.from("odds").insert({
    season_id: seasonId,
    format,
    value,
    athlete_id: athleteId ?? null,
    nation_code: athleteId ? null : nationCode,
    nation_sex: athleteId ? null : (nationSex ?? null),
  });
  if (insertError) throw new Error(insertError.message);
}

/**
 * Historise la cote courante d'un athlète ou d'une nation pour un format, sans la remplacer.
 * Relais mixtes : `nationSex` absent, la cote n'a pas de sexe en base.
 */
export async function clearCurrentOdds(
  admin: SupabaseClient,
  params: { seasonId: string; format: string; athleteId?: string; nationCode?: string; nationSex?: string }
): Promise<void> {
  const { seasonId, format, athleteId, nationCode, nationSex } = params;

  let query = admin
    .from("odds")
    .update({ valid_until: new Date().toISOString() })
    .eq("season_id", seasonId)
    .eq("format", format)
    .is("valid_until", null);

  if (athleteId) query = query.eq("athlete_id", athleteId);
  else {
    query = query.eq("nation_code", nationCode!);
    query = nationSex ? query.eq("nation_sex", nationSex) : query.is("nation_sex", null);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}
