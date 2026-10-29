import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Liste de départ des courses à qualification : seuls les 60 premiers du sprint prennent le
 * départ de la poursuite, et 30 athlètes celui de la mass start (25 premiers du général de la
 * Coupe du monde + 5 meilleurs de l'étape, règle IBU). Tant qu'elle n'est pas connue, la course
 * ne peut pas être pronostiquée.
 */
export const START_LIST_FORMATS = ["poursuite", "mass_start"];
export const PURSUIT_FIELD_SIZE = 60;

export type StartList =
  /** Course sans qualification : tous les biathlètes ayant une cote. */
  | { status: "open" }
  /** Liste pas encore connue (sprint non saisi, liste IBU non récupérée). */
  | { status: "pending" }
  /** Athlète → place dans l'ordre de départ. */
  | { status: "known"; order: Record<string, number>; source: "ibu" | "sprint" };

/**
 * Partie pure (testée). La liste officielle IBU, si l'admin l'a récupérée, prime ; à défaut, la
 * poursuite reprend les 60 premiers du sprint saisi. La mass start n'a pas d'autre source : son
 * classement de qualification (général de la Coupe du monde) n'est pas dans l'application.
 */
export function resolveStartList(
  format: string,
  stored: { athlete_id: string; start_position: number }[],
  sprintResults: { athlete_id: string | null; rank: number }[]
): StartList {
  if (!START_LIST_FORMATS.includes(format)) return { status: "open" };
  if (stored.length > 0) {
    return { status: "known", source: "ibu", order: Object.fromEntries(stored.map((s) => [s.athlete_id, s.start_position])) };
  }
  if (format === "poursuite") {
    const qualified = sprintResults.filter((r) => r.athlete_id && r.rank <= PURSUIT_FIELD_SIZE);
    if (qualified.length > 0) {
      return { status: "known", source: "sprint", order: Object.fromEntries(qualified.map((r) => [r.athlete_id!, r.rank])) };
    }
  }
  return { status: "pending" };
}

/** Sprint de l'étape (même sexe) qui précède la poursuite : il en fixe l'ordre de départ. */
export async function findQualifyingSprint(
  supabase: SupabaseClient,
  race: { stage_id: string; sex: string | null; locks_at: string }
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("races")
    .select("id")
    .eq("stage_id", race.stage_id)
    .eq("format", "sprint")
    .eq("sex", race.sex)
    .lt("locks_at", race.locks_at)
    .order("locks_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getStartList(
  supabase: SupabaseClient,
  race: { id: string; format: string; stage_id: string; sex: string | null; locks_at: string }
): Promise<StartList> {
  if (!START_LIST_FORMATS.includes(race.format)) return { status: "open" };
  const { data: stored } = await supabase.from("race_start_lists").select("athlete_id, start_position").eq("race_id", race.id);
  let sprintResults: { athlete_id: string | null; rank: number }[] = [];
  if (race.format === "poursuite" && (stored ?? []).length === 0) {
    const sprint = await findQualifyingSprint(supabase, race);
    if (sprint) {
      const { data } = await supabase.from("race_results").select("athlete_id, rank").eq("race_id", sprint.id);
      sprintResults = data ?? [];
    }
  }
  return resolveStartList(race.format, stored ?? [], sprintResults);
}
