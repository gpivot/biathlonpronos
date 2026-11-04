import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./admin/fetchAll";

/**
 * Jokers de fin de saison (décision de Guillaume, 01/11/2026) : on efface les 3 plus mauvais
 * résultats de courses individuelles (hors Mondiaux/JO) et les 2 plus mauvais relais (hors
 * Mondiaux/JO aussi, à confirmer). Une course non jouée compte comme un résultat à effacer en
 * priorité. Les courses malus et bonus (`races.special_rule` renseigné : Tour de péna, Brouillard,
 * T'es collé, Fête nationale…) ne sont jamais effacées non plus (décision de Guillaume, 04/11/2026).
 * Les jokers ne s'appliquent au classement qu'une fois la saison terminée, quand l'admin
 * les active (`seasons.jokers_applied`) ; avant, « Ma saison » en montre un aperçu.
 *
 * Effacer un résultat retire ses points du total (un 0 ne change rien, un malus négatif est
 * rendu, un petit score positif est retiré) : c'est ce qui équilibre les joueurs qui ont manqué
 * des courses et ceux qui les ont toutes jouées. Le bonus Pépite, gagné sur une course mais lié
 * au pronostic de saison, n'est jamais effacé.
 */

export const JOKERS_PER_SEASON = { individual: 3, relay: 2 } as const;

const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

/** Une course terminée de la saison, vue par un joueur. */
export interface JokerCandidate {
  raceId: string;
  relay: boolean;
  /** Mondiaux ou JO (coefficient 2) : jamais effacée. */
  championship: boolean;
  /** Course malus ou bonus (règle spéciale) : jamais effacée. */
  special?: boolean;
  /** Le joueur a déposé un pronostic sur cette course. */
  played: boolean;
  /** Points de la course pour le joueur (hors bonus Pépite), 0 s'il n'en a pas. */
  points: number;
}

export interface JokerSelection {
  /** Courses effacées, dans l'ordre où les jokers les prennent. */
  erased: JokerCandidate[];
  /** Variation du total : moins la somme des points effacés. */
  delta: number;
}

/**
 * Partie pure (testée) : les courses que les jokers effacent. Par type (individuelle, relais) :
 * d'abord les courses non jouées, puis les plus petits scores ; à égalité, la plus ancienne
 * (ordre reçu). Les candidats sont les courses terminées, dans l'ordre chronologique.
 */
export function selectJokers(candidates: JokerCandidate[]): JokerSelection {
  const pick = (relay: boolean, count: number) =>
    candidates
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => c.relay === relay && !c.championship && !c.special)
      .sort((a, b) => Number(a.c.played) - Number(b.c.played) || a.c.points - b.c.points || a.index - b.index)
      .slice(0, count)
      .map(({ c }) => c);
  const erased = [...pick(false, JOKERS_PER_SEASON.individual), ...pick(true, JOKERS_PER_SEASON.relay)];
  const delta = -erased.reduce((sum, c) => sum + c.points, 0);
  return { erased, delta: Math.round(delta * 10) / 10 + 0 };
}

export interface JokerRace {
  id: string;
  format: string;
  coefficient: number;
  finished: boolean;
  /** Règle spéciale (course malus ou bonus), null pour une course normale. */
  specialRule?: string | null;
}

/**
 * Partie pure (testée) : jokers de chaque joueur à partir des courses de la saison (ordre
 * chronologique), de ses lignes de score et de ses pronostics.
 */
export function computeSeasonJokers(
  races: JokerRace[],
  ledger: { userId: string; raceId: string | null; points: number; pepiteBonus?: number | null }[],
  predictions: { userId: string; raceId: string; played: boolean }[],
  userIds: string[]
): Map<string, JokerSelection> {
  const finished = races.filter((r) => r.finished);
  const pointsByKey = new Map<string, number>();
  for (const row of ledger) {
    if (!row.raceId) continue;
    const key = `${row.userId}|${row.raceId}`;
    pointsByKey.set(key, (pointsByKey.get(key) ?? 0) + Number(row.points) - Number(row.pepiteBonus ?? 0));
  }
  const playedKeys = new Set(predictions.filter((p) => p.played).map((p) => `${p.userId}|${p.raceId}`));

  const result = new Map<string, JokerSelection>();
  for (const userId of userIds) {
    result.set(
      userId,
      selectJokers(
        finished.map((race) => ({
          raceId: race.id,
          relay: RELAY_FORMATS.includes(race.format),
          championship: race.coefficient === 2,
          special: Boolean(race.specialRule),
          played: playedKeys.has(`${userId}|${race.id}`),
          points: pointsByKey.get(`${userId}|${race.id}`) ?? 0,
        }))
      )
    );
  }
  return result;
}

/** Les jokers sont-ils appliqués au classement ? (false si la colonne n'existe pas encore en base.) */
export async function areJokersApplied(supabase: SupabaseClient, seasonId: string): Promise<boolean> {
  const { data, error } = await supabase.from("seasons").select("jokers_applied").eq("id", seasonId).maybeSingle();
  if (error) return false;
  return Boolean((data as any)?.jokers_applied);
}

/** Jokers de tous les joueurs donnés (ou d'un seul), lus en base. */
export async function loadSeasonJokers(
  supabase: SupabaseClient,
  seasonId: string,
  userIds: string[]
): Promise<Map<string, JokerSelection>> {
  if (userIds.length === 0) return new Map();
  const { data: races } = await supabase
    .from("races")
    .select("id, format, status, locks_at, special_rule, stages!inner(season_id, coefficient)")
    .eq("stages.season_id", seasonId)
    .order("locks_at", { ascending: true });
  const jokerRaces: JokerRace[] = ((races ?? []) as any[]).map((r) => ({
    id: r.id,
    format: r.format,
    coefficient: r.stages?.coefficient ?? 1,
    finished: r.status === "finished",
    specialRule: r.special_rule ?? null,
  }));
  const finishedIds = jokerRaces.filter((r) => r.finished).map((r) => r.id);
  if (finishedIds.length === 0) return computeSeasonJokers([], [], [], userIds);

  const single = userIds.length === 1 ? userIds[0] : null;
  const [ledger, predictions] = await Promise.all([
    fetchAll<any>((from, to) => {
      let query = supabase
        .from("score_ledger")
        .select("id, user_id, race_id, points, pepite:breakdown->pepiteBonus")
        .eq("season_id", seasonId)
        .not("race_id", "is", null);
      if (single) query = query.eq("user_id", single);
      return query.order("id").range(from, to);
    }),
    fetchAll<any>((from, to) => {
      let query = supabase.from("predictions").select("id, user_id, race_id, athlete_ids, nation_code").in("race_id", finishedIds);
      if (single) query = query.eq("user_id", single);
      return query.order("id").range(from, to);
    }),
  ]);

  return computeSeasonJokers(
    jokerRaces,
    ledger.map((l) => ({ userId: l.user_id, raceId: l.race_id, points: Number(l.points), pepiteBonus: Number(l.pepite ?? 0) })),
    predictions.map((p) => ({
      userId: p.user_id,
      raceId: p.race_id,
      played: (p.athlete_ids?.length ?? 0) > 0 || Boolean(p.nation_code),
    })),
    userIds
  );
}
