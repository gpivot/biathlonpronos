import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pépite cachée et équipe favorite (Guillaume, 24/11/2026) : modifiables jusqu'au départ de la
 * première course de Coupe du Monde de la saison (étape ×1 qui compte au classement ; les étapes
 * « Autre (×0) », ex. pré-saison, ne comptent pas), puis verrouillées.
 * Même règle côté base : first_world_cup_race_at / season_choices_editable (migration 0046).
 */
export async function getFirstWorldCupRaceAt(supabase: SupabaseClient, seasonId: string): Promise<Date | null> {
  const { data } = await supabase
    .from("races")
    .select("locks_at, stages!inner(season_id, coefficient, counts_in_standings)")
    .eq("stages.season_id", seasonId)
    .eq("stages.coefficient", 1)
    .eq("stages.counts_in_standings", true)
    .order("locks_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.locks_at ? new Date(data.locks_at as string) : null;
}

/** Encore modifiable ? Oui tant que la 1re course n'est pas partie (ou pas encore au calendrier). */
export function seasonChoicesEditable(firstWorldCupRaceAt: Date | null, now: Date): boolean {
  return firstWorldCupRaceAt === null || firstWorldCupRaceAt.getTime() > now.getTime();
}

/**
 * Ouverture des pronostics de saison (Guillaume, 24/11/2026) : 6 globes + Pépites cachées.
 * Chaque joueur peut les faire ou les modifier jusqu'au départ de la PREMIÈRE COURSE QU'IL
 * PRONOSTIQUE (étape qui compte au classement), et au plus tard jusqu'au départ de la mass start
 * femmes du Grand-Bornand : ensuite, tout est fermé pour tout le monde. Comme la 1re course qu'un
 * joueur pronostique ne peut pas partir avant la 1re course de Coupe du Monde, tout le monde peut
 * modifier jusque-là ; après, seuls les nouveaux joueurs (aucune course pronostiquée déjà partie)
 * peuvent encore les saisir.
 * Même règle côté base : season_picks_closes_at / season_picks_open (migration 0047).
 */
export const SEASON_PICKS_CLOSING_RACE = { locationLike: "%bornand%", format: "mass_start", sex: "F" } as const;

/** Départ de la mass start femmes du Grand-Bornand (null si pas au calendrier). */
export async function getSeasonPicksClosingRaceAt(supabase: SupabaseClient, seasonId: string): Promise<Date | null> {
  const { data } = await supabase
    .from("races")
    .select("locks_at, stages!inner(season_id, location)")
    .eq("stages.season_id", seasonId)
    .ilike("stages.location", SEASON_PICKS_CLOSING_RACE.locationLike)
    .eq("format", SEASON_PICKS_CLOSING_RACE.format)
    .eq("sex", SEASON_PICKS_CLOSING_RACE.sex)
    .order("locks_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.locks_at ? new Date(data.locks_at as string) : null;
}

/** Départ de la 1re course (qui compte au classement) que le joueur a pronostiquée, partie ou non. */
export async function getFirstPredictedRaceAt(supabase: SupabaseClient, seasonId: string, userId: string): Promise<Date | null> {
  const { data } = await supabase
    .from("predictions")
    .select("races!inner(locks_at, stages!inner(season_id, counts_in_standings))")
    .eq("user_id", userId)
    .eq("races.stages.season_id", seasonId)
    .eq("races.stages.counts_in_standings", true);
  const times = ((data ?? []) as any[])
    .map((p) => (p.races?.locks_at ? new Date(p.races.locks_at as string).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

/**
 * Fermeture des pronostics de saison pour ce joueur : la plus proche entre sa 1re course
 * pronostiquée et la mass start femmes du Grand-Bornand (à défaut, la 1re course de Coupe du
 * Monde). null : rien au calendrier, donc encore ouvert.
 */
export function seasonPicksClosesAt({
  firstPredictedRaceAt,
  closingRaceAt,
  firstWorldCupRaceAt,
}: {
  firstPredictedRaceAt: Date | null;
  closingRaceAt: Date | null;
  firstWorldCupRaceAt: Date | null;
}): Date | null {
  const candidates = [firstPredictedRaceAt, closingRaceAt ?? firstWorldCupRaceAt].filter((d): d is Date => d !== null);
  return candidates.length > 0 ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;
}

export interface SeasonPicksWindow {
  open: boolean;
  /** Date de fermeture pour ce joueur (null : pas encore de course au calendrier). */
  closesAt: Date | null;
  firstWorldCupRaceAt: Date | null;
}

export async function getSeasonPicksWindow(
  supabase: SupabaseClient,
  seasonId: string,
  userId: string,
  now: Date,
  firstWorldCupRaceAt?: Date | null
): Promise<SeasonPicksWindow> {
  const [firstWc, closingRaceAt, firstPredictedRaceAt] = await Promise.all([
    firstWorldCupRaceAt !== undefined ? Promise.resolve(firstWorldCupRaceAt) : getFirstWorldCupRaceAt(supabase, seasonId),
    getSeasonPicksClosingRaceAt(supabase, seasonId),
    getFirstPredictedRaceAt(supabase, seasonId, userId),
  ]);
  const closesAt = seasonPicksClosesAt({ firstPredictedRaceAt, closingRaceAt, firstWorldCupRaceAt: firstWc });
  return { open: seasonChoicesEditable(closesAt, now), closesAt, firstWorldCupRaceAt: firstWc };
}
