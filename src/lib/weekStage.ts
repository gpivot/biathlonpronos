import type { SupabaseClient } from "@supabase/supabase-js";
import { toParisWallTime } from "./displayTimeZone";
import { getRaceDisplayStatus } from "./raceStatus";

/**
 * Encart « L'étape de la semaine » de l'accueil : l'étape en cours (ou, à
 * défaut, celle qui commence dans les 7 prochains jours), avec les courses en
 * cours et le pronostic du joueur, et la prochaine course encore à jouer.
 */

export interface WeekStagePick {
  key: string;
  name: string;
  nationCode: string;
}

export interface WeekStageRace {
  id: string;
  format: string;
  sex: string | null;
  locksAt: string;
  /** null : pas de pronostic enregistré. */
  picks: WeekStagePick[] | null;
}

export interface WeekStage {
  id: string;
  location: string;
  countryCode: string;
  coefficient: number;
  /** Une course de l'étape a lieu aujourd'hui (heure de Paris) : badge « En ce moment ». */
  raceToday: boolean;
  /** Courses dont le départ est passé mais pas encore notées par l'admin. */
  ongoing: WeekStageRace[];
  /** Prochaine course de l'étape sans pronostic, encore ouverte : bouton « À jouer ». */
  toPlay: WeekStageRace | null;
}

/** Jour de Paris ("2026-11-29") d'un instant. */
export function parisDay(date: Date): string {
  return toParisWallTime(date).slice(0, 10);
}

/** Jour de Paris décalé de `days` jours ("2026-11-29" + 7 → "2026-12-06"). */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface RaceRow {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
  status: string;
}

/** Partie pure (testée) : badge du jour, courses en cours, course à jouer. */
export function summarizeStageRaces(
  races: RaceRow[],
  predictedRaceIds: Set<string>,
  now: Date
): { raceToday: boolean; ongoingIds: string[]; toPlayId: string | null } {
  const today = parisDay(now);
  const sorted = [...races].sort((a, b) => a.locks_at.localeCompare(b.locks_at));
  const raceToday = sorted.some((r) => parisDay(new Date(r.locks_at)) === today);
  const ongoingIds = sorted.filter((r) => getRaceDisplayStatus(r as any, now) === "ongoing").map((r) => r.id);
  const toPlay = sorted.find((r) => getRaceDisplayStatus(r as any, now) === "upcoming" && !predictedRaceIds.has(r.id));
  return { raceToday, ongoingIds, toPlayId: toPlay?.id ?? null };
}

export async function getWeekStage(
  supabase: SupabaseClient,
  seasonId: string,
  userId: string,
  now: Date
): Promise<WeekStage | null> {
  const today = parisDay(now);
  const select = "id, location, country_code, coefficient";
  const { data: current } = await supabase
    .from("stages")
    .select(select)
    .eq("season_id", seasonId)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("starts_on", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: stage } = current
    ? { data: current }
    : await supabase
        .from("stages")
        .select(select)
        .eq("season_id", seasonId)
        .gt("starts_on", today)
        .lte("starts_on", addDays(today, 7))
        .order("starts_on", { ascending: true })
        .limit(1)
        .maybeSingle();
  if (!stage) return null;

  const { data: raceRows } = await supabase
    .from("races")
    .select("id, format, sex, locks_at, status")
    .eq("stage_id", stage.id)
    .order("locks_at", { ascending: true });
  const races = (raceRows ?? []) as RaceRow[];

  const { data: predictionRows } = races.length
    ? await supabase
        .from("predictions")
        .select("race_id, athlete_ids, nation_code")
        .eq("user_id", userId)
        .in(
          "race_id",
          races.map((r) => r.id)
        )
    : { data: [] as any[] };
  type PredictionRow = { race_id: string; athlete_ids: string[] | null; nation_code: string | null };
  const predictions = new Map<string, PredictionRow>(
    ((predictionRows ?? []) as PredictionRow[])
      .filter((p) => (p.athlete_ids?.length ?? 0) > 0 || p.nation_code)
      .map((p) => [p.race_id, p])
  );

  const { raceToday, ongoingIds, toPlayId } = summarizeStageRaces(races, new Set(predictions.keys()), now);

  // Noms des athlètes et nations pronostiqués sur les courses en cours.
  const ongoingPredictions = ongoingIds.map((id) => predictions.get(id)).filter(Boolean) as {
    athlete_ids: string[] | null;
    nation_code: string | null;
  }[];
  const athleteIds = ongoingPredictions.flatMap((p) => p.athlete_ids ?? []);
  const nationCodes = ongoingPredictions.map((p) => p.nation_code).filter(Boolean) as string[];
  const [{ data: athletes }, { data: nations }] = await Promise.all([
    athleteIds.length
      ? supabase.from("athletes").select("id, first_name, last_name, nation_code").in("id", athleteIds)
      : Promise.resolve({ data: [] as any[] }),
    nationCodes.length
      ? supabase.from("nations").select("code, name").in("code", nationCodes)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const toRace = (r: RaceRow, withPicks: boolean): WeekStageRace => {
    const p = predictions.get(r.id);
    let picks: WeekStagePick[] | null = null;
    if (withPicks && p) {
      picks = p.nation_code
        ? [
            {
              key: p.nation_code,
              name: (nations ?? []).find((n: any) => n.code === p.nation_code)?.name ?? p.nation_code,
              nationCode: p.nation_code,
            },
          ]
        : (p.athlete_ids ?? []).map((id) => {
            const a = (athletes ?? []).find((x: any) => x.id === id);
            return {
              key: id,
              name: a ? `${a.first_name ? `${a.first_name[0]}. ` : ""}${a.last_name ?? ""}` : "?",
              nationCode: a?.nation_code ?? "",
            };
          });
    }
    return { id: r.id, format: r.format, sex: r.sex, locksAt: r.locks_at, picks };
  };

  const toPlayRow = races.find((r) => r.id === toPlayId);
  return {
    id: stage.id,
    location: stage.location,
    countryCode: stage.country_code,
    coefficient: stage.coefficient,
    raceToday,
    ongoing: races.filter((r) => ongoingIds.includes(r.id)).map((r) => toRace(r, true)),
    toPlay: toPlayRow ? toRace(toPlayRow, false) : null,
  };
}
