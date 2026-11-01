import type { SupabaseClient } from "@supabase/supabase-js";
import { getRaceDisplayStatus } from "./raceStatus";
import type { CalendarStage } from "../app/[locale]/courses/CalendarAccordion";
import type { SeasonPick } from "../app/[locale]/courses/SeasonPredictionsAccordion";
import { shortAthleteName } from "./athleteName";
import { getCurrentStreak } from "./streakCounter";
import { isPredictionOpen, predictionOpensOn } from "./predictionWindow";
import { getPlayerCards, type PlayerCards } from "./bonusCards";
import { areJokersApplied, loadSeasonJokers } from "./jokers";

/** Une course effacée par les jokers de fin de saison, telle qu'affichée dans « Ma saison ». */
export interface JokerLine {
  raceId: string;
  format: string;
  sex: string | null;
  location: string;
  countryCode: string | null;
  played: boolean;
  points: number;
}

export interface SeasonJokers {
  /** Appliqués au classement (fin de saison) ; sinon simple aperçu. */
  applied: boolean;
  /** Variation du total : moins la somme des points effacés. */
  delta: number;
  erased: JokerLine[];
}

/**
 * Contenu de « Ma saison » (`/courses`) pour un joueur : courses de chaque étape avec son
 * pronostic, son bonus ×2 et ses points, plus ses pronostics de saison (globes, Pépites).
 * Sert aussi au pop-up d'un joueur du Classement (`isOwner` false) : on n'y montre que ce qui
 * ne permet pas de copier, c'est-à-dire les pronostics des courses déjà parties, les globes
 * une fois la saison commencée et une Pépite une fois révélée (bonus obtenu). Les règles
 * d'accès Supabase (migration 0018) appliquent la même chose côté base.
 */

const SEASON_CATEGORIES = [
  "gros_globe_f",
  "gros_globe_h",
  "meilleur_jeune_f",
  "meilleur_jeune_h",
  "meilleure_nation_f",
  "meilleure_nation_h",
] as const;

const shortName = (a: { first_name?: string; last_name?: string } | null | undefined) => shortAthleteName(a);

export interface SeasonView {
  stages: CalendarStage[];
  /** null : visiteur non connecté. */
  seasonPicks: SeasonPick[] | null;
  /** Série en cours (10/10), null pour un visiteur. */
  streak: number | null;
  /** Cartes bonus (crédits à choisir et cartes prises), null pour un visiteur. */
  cards: PlayerCards | null;
  /** Jokers de fin de saison (aperçu ou appliqués), pour le joueur lui-même seulement. */
  jokers: SeasonJokers | null;
}

export async function getSeasonView(
  supabase: SupabaseClient,
  season: { id: string; starts_on: string },
  userId: string | null,
  now: Date,
  isOwner = true
): Promise<SeasonView> {
  const seasonStarted = new Date(season.starts_on) <= now;
  const showSeasonPicks = isOwner || seasonStarted;

  const withJokers = Boolean(userId && isOwner);
  const [{ data: predictionRows }, { data: ledger }, { data: seasonPredictions }, { data: pepiteRows }, streak, cards, jokersApplied, jokerSelections] = await Promise.all([
    userId
      ? supabase.from("predictions").select("race_id, athlete_ids, nation_code, bonus_x2_used").eq("user_id", userId)
      : Promise.resolve({ data: [] as any[] }),
    userId
      ? supabase.from("score_ledger").select("race_id, points").eq("user_id", userId).eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
    userId && showSeasonPicks
      ? supabase
          .from("season_predictions")
          .select("category, athlete_id, nation_code")
          .eq("user_id", userId)
          .eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
    userId
      ? supabase.from("pepites").select("sex, athlete_id, bonus_claimed").eq("user_id", userId).eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
    userId ? getCurrentStreak(supabase, season.id, userId) : Promise.resolve(null),
    userId ? getPlayerCards(supabase, season.id, userId, now) : Promise.resolve(null),
    withJokers ? areJokersApplied(supabase, season.id) : Promise.resolve(false),
    withJokers ? loadSeasonJokers(supabase, season.id, [userId!]) : Promise.resolve(null),
  ]);

  const { data: stages, error } = await supabase
    .from("stages")
    .select("id, location, country_code, starts_on, ends_on, coefficient, races(id, format, sex, locks_at, status, special_rule)")
    .eq("season_id", season.id)
    .order("starts_on", { ascending: true });
  if (error) console.error("getSeasonView:", error.message);

  // Chez un autre joueur, rien sur une course pas encore partie.
  const lockedRaceIds = new Set(
    (stages ?? []).flatMap((s: any) => (s.races ?? []) as any[]).filter((r) => new Date(r.locks_at) <= now).map((r) => r.id as string)
  );
  const predictions = (predictionRows ?? []).filter((p: any) => isOwner || lockedRaceIds.has(p.race_id));
  const pepites = (pepiteRows ?? []).filter((p: any) => isOwner || p.bonus_claimed);

  const predictionByRaceId = new Map(predictions.map((p: any) => [p.race_id as string, p]));
  const pointsByRaceId = new Map((ledger ?? []).map((l: any) => [l.race_id as string, Number(l.points)]));

  const athleteIds = Array.from(
    new Set([
      ...predictions.flatMap((p: any) => p.athlete_ids ?? []),
      ...(seasonPredictions ?? []).map((p: any) => p.athlete_id).filter(Boolean),
      ...pepites.map((p: any) => p.athlete_id),
    ])
  );
  const nationCodes = Array.from(
    new Set(
      [...predictions.map((p: any) => p.nation_code), ...(seasonPredictions ?? []).map((p: any) => p.nation_code)].filter(Boolean)
    )
  );
  const [{ data: athletes }, { data: nations }] = await Promise.all([
    athleteIds.length
      ? supabase.from("athletes").select("id, first_name, last_name, nation_code").in("id", athleteIds)
      : Promise.resolve({ data: [] as any[] }),
    nationCodes.length ? supabase.from("nations").select("code, name").in("code", nationCodes) : Promise.resolve({ data: [] as any[] }),
  ]);
  const athleteById = new Map((athletes ?? []).map((a: any) => [a.id as string, a]));
  const nationNameByCode = new Map((nations ?? []).map((n: any) => [n.code as string, n.name as string]));
  const pickNames = (p: any): string =>
    p.nation_code
      ? nationNameByCode.get(p.nation_code) ?? p.nation_code
      : (p.athlete_ids ?? []).map((id: string) => shortName(athleteById.get(id))).join(", ");

  const seasonPickByCategory = new Map((seasonPredictions ?? []).map((p: any) => [p.category as string, p]));
  const seasonPicks: SeasonPick[] | null = userId
    ? [
        ...SEASON_CATEGORIES.map((category) => {
          const pick = seasonPickByCategory.get(category);
          const athlete = pick?.athlete_id ? athleteById.get(pick.athlete_id) : null;
          return {
            key: category,
            labelKey: `category_${category}`,
            name: pick ? (athlete ? shortName(athlete) : nationNameByCode.get(pick.nation_code) ?? pick.nation_code) : null,
            nationCode: athlete?.nation_code ?? pick?.nation_code ?? null,
          };
        }),
        ...(["F", "H"] as const).map((sex) => {
          const pepite = pepites.find((p: any) => p.sex === sex);
          const athlete = pepite ? athleteById.get(pepite.athlete_id) : null;
          return {
            key: `pepite_${sex}`,
            labelKey: `pepite_${sex}`,
            name: athlete ? shortName(athlete) : null,
            nationCode: athlete?.nation_code ?? null,
          };
        }),
      ]
    : null;

  const mapped: CalendarStage[] = (stages ?? []).map((stage: any) => ({
    id: stage.id,
    location: stage.location,
    country_code: stage.country_code,
    starts_on: stage.starts_on,
    ends_on: stage.ends_on,
    coefficient: stage.coefficient,
    opensOn: isPredictionOpen(stage.starts_on, now) ? null : predictionOpensOn(stage.starts_on),
    races: (stage.races ?? [])
      .map((race: any) => ({
        ...race,
        displayStatus: getRaceDisplayStatus(race, now),
        predicted: predictionByRaceId.has(race.id),
        names: predictionByRaceId.has(race.id) ? pickNames(predictionByRaceId.get(race.id)) : null,
        bonusX2: predictionByRaceId.get(race.id)?.bonus_x2_used ?? false,
        points: pointsByRaceId.get(race.id) ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()),
  }));

  const raceInfo = new Map(
    mapped.flatMap((stage) => stage.races.map((race: any) => [race.id as string, { race, stage }] as const))
  );
  const selection = jokerSelections?.get(userId ?? "") ?? null;
  const jokers: SeasonJokers | null =
    selection && raceInfo.size > 0 && mapped.some((stage) => stage.races.some((r: any) => r.status === "finished"))
      ? {
          applied: jokersApplied,
          delta: selection.delta,
          erased: selection.erased.map((c) => {
            const info = raceInfo.get(c.raceId);
            return {
              raceId: c.raceId,
              format: info?.race.format ?? "",
              sex: info?.race.sex ?? null,
              location: info?.stage.location ?? "",
              countryCode: info?.stage.country_code ?? null,
              played: c.played,
              points: c.points,
            };
          }),
        }
      : null;

  return { stages: mapped, seasonPicks, streak, cards, jokers };
}

/** Étape ouverte par défaut : la première qui n'est pas entièrement terminée. */
export function pickDefaultOpenStageId(stages: CalendarStage[]): string | null {
  const current = stages.find((stage) => stage.races.some((r) => r.displayStatus !== "finished"));
  return current?.id ?? stages[0]?.id ?? null;
}
