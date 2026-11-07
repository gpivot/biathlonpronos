import type { SupabaseClient } from "@supabase/supabase-js";
import { RELAY_FORMATS } from "../raceFormats";
import { GENERAL_FIELD_FORMATS, GENERAL_FIELD_SIZE } from "../startList";
import { predictionOpensAt } from "../predictionWindow";
import { addDays, parisDay } from "../weekStage";
import { fetchIbuCupRanking, ibuCategory } from "./ibuResults";
import { matchStartList, matchStartNations, saveStartList, saveStartNations, type StartListCandidate } from "./startListImport";

/**
 * Ouverture des pronostics du lundi 17 h (règle du 07/11/2026) : liste de départ provisoire des
 * sprints et individuels (60 premiers du général de la Coupe du monde, par sexe) et des relais
 * (nations classées au général du relais). La liste officielle IBU, récupérée à la main depuis le
 * back-office, la remplace ensuite. Poursuite et mass start ne sont pas concernées.
 */

/**
 * La liste provisoire est préparée à partir de 2 h avant l'ouverture, pour être prête à 17 h pile,
 * et retentée jusqu'à 6 h après en cas d'échec (IBU indisponible). Au-delà, une liste effacée à
 * la main n'est plus remplacée.
 */
export const OPENING_PREPARE_MS = 2 * 3600 * 1000;
export const OPENING_RETRY_MS = 6 * 3600 * 1000;

export interface OpeningRace {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
  stages: { season_id: string; starts_on: string; location?: string };
}

type Ranking = Awaited<ReturnType<typeof fetchIbuCupRanking>>;

/** Classements déjà lus pendant un passage (une étape a souvent 2 sprints et 2 relais). */
export type RankingCache = Map<string, Promise<Ranking>>;

function cachedRanking(cache: RankingCache, date: string, kind: "total" | "relay", category: "SW" | "SM" | "MX", limit?: number) {
  const key = `${date.slice(0, 7)}|${kind}|${category}|${limit ?? ""}`;
  if (!cache.has(key)) cache.set(key, fetchIbuCupRanking({ date, kind, category, limit }));
  return cache.get(key)!;
}

/**
 * Relais mixtes : général du relais mixte s'il existe, sinon nations classées à la fois au
 * général du relais femmes et à celui des hommes (à confirmer).
 */
async function relayNations(cache: RankingCache, date: string, category: "SW" | "SM" | "MX"): Promise<{ nations: string[]; note: string }> {
  try {
    const ranking = await cachedRanking(cache, date, "relay", category);
    return { nations: ranking.rows.map((r) => r.nation), note: ranking.cupId + (ranking.previousSeason ? " (saison précédente)" : "") };
  } catch (error) {
    if (category !== "MX") throw error;
    const [women, men] = await Promise.all([cachedRanking(cache, date, "relay", "SW"), cachedRanking(cache, date, "relay", "SM")]);
    const menNations = new Set(men.rows.map((r) => r.nation));
    return { nations: women.rows.map((r) => r.nation).filter((n) => menNations.has(n)), note: `${women.cupId} + ${men.cupId}` };
  }
}

/** Place la liste provisoire d'une course (remplace celle déjà enregistrée). Renvoie un compte rendu. */
export async function placeGeneralStartList(admin: SupabaseClient, race: OpeningRace, cache: RankingCache = new Map()): Promise<string> {
  const category = ibuCategory(race.format, race.sex);
  const { data: odds } = await admin
    .from("odds")
    .select("athlete_id, nation_code, athletes(first_name, last_name, nation_code, sex)")
    .eq("season_id", race.stages.season_id)
    .eq("format", race.format)
    .is("valid_until", null);

  if (RELAY_FORMATS.includes(race.format)) {
    const { nations, note } = await relayNations(cache, race.stages.starts_on, category);
    const matched = matchStartNations(
      nations.map((nation) => ({ nation })),
      (odds ?? []).map((o: any) => o.nation_code).filter(Boolean)
    );
    if (matched.rows.length === 0) throw new Error(`aucune nation du général (${note}) n'a de cote pour ce relais`);
    await saveStartNations(admin, race.id, matched.rows, "general");
    return `${matched.rows.length} nation(s) du général (${note})` + (matched.unmatched.length ? `, sans cote : ${matched.unmatched.join(", ")}` : "");
  }

  if (!GENERAL_FIELD_FORMATS.includes(race.format)) throw new Error(`format ${race.format} non concerné`);
  const ranking = await cachedRanking(cache, race.stages.starts_on, "total", category, GENERAL_FIELD_SIZE);
  const candidates: StartListCandidate[] = (odds ?? [])
    .filter((o: any) => o.athlete_id && (!race.sex || o.athletes?.sex === race.sex))
    .map((o: any) => ({
      id: o.athlete_id,
      firstName: o.athletes?.first_name ?? "",
      lastName: o.athletes?.last_name ?? "",
      nationCode: o.athletes?.nation_code ?? "",
    }));
  // Le général donne « NOM Prénom » d'un bloc : la comparaison des noms accepte les deux ordres.
  const matched = matchStartList(
    ranking.rows.map((r) => ({ position: r.rank, bib: null, firstName: "", lastName: r.name, nation: r.nation })),
    candidates
  );
  if (matched.rows.length === 0) throw new Error(`aucun biathlète du général (${ranking.cupId}) n'a de cote pour ce format`);
  await saveStartList(admin, race.id, matched.rows, "general");
  return (
    `${matched.rows.length} biathlète(s) sur les ${ranking.rows.length} premiers du général (${ranking.cupId}${ranking.previousSeason ? ", saison précédente" : ""})` +
    (matched.unmatched.length ? `, sans cote : ${matched.unmatched.join(", ")}` : "")
  );
}

/** Partie pure (testée) : la liste provisoire est-elle à préparer pour cette course maintenant ? */
export function needsGeneralStartList(race: Pick<OpeningRace, "format" | "locks_at" | "stages">, now: Date): boolean {
  if (!GENERAL_FIELD_FORMATS.includes(race.format) && !RELAY_FORMATS.includes(race.format)) return false;
  if (new Date(race.locks_at).getTime() <= now.getTime()) return false;
  const opensAt = predictionOpensAt(race.stages.starts_on).getTime();
  return now.getTime() >= opensAt - OPENING_PREPARE_MS && now.getTime() <= opensAt + OPENING_RETRY_MS;
}

/**
 * Tâche planifiée (appelée tous les quarts d'heure) : pour chaque étape qui ouvre bientôt, place
 * la liste provisoire des courses qui n'ont encore aucune liste. Une liste déjà enregistrée
 * (provisoire ou officielle) n'est jamais remplacée ici.
 */
export async function runStartListOpening(admin: SupabaseClient, now: Date): Promise<string> {
  const today = parisDay(now);
  const { data: races, error } = await admin
    .from("races")
    .select("id, format, sex, locks_at, stages!inner(season_id, starts_on, location)")
    .neq("status", "finished")
    .gt("locks_at", now.toISOString())
    .in("format", [...GENERAL_FIELD_FORMATS, ...RELAY_FORMATS])
    .gte("stages.starts_on", today)
    .lte("stages.starts_on", addDays(today, 8));
  if (error) throw new Error(error.message);

  const due = ((races ?? []) as unknown as OpeningRace[]).filter((r) => needsGeneralStartList(r, now));
  if (due.length === 0) return "Listes de départ : rien à ouvrir.";

  const [{ data: athleteLists }, { data: nationLists }] = await Promise.all([
    admin.from("race_start_lists").select("race_id").in("race_id", due.map((r) => r.id)),
    admin.from("race_start_nations").select("race_id").in("race_id", due.map((r) => r.id)),
  ]);
  const withList = new Set([...(athleteLists ?? []), ...(nationLists ?? [])].map((r) => r.race_id as string));

  const cache: RankingCache = new Map();
  const report: string[] = [];
  for (const race of due) {
    if (withList.has(race.id)) continue;
    const label = `${race.stages.location ?? ""} ${race.format}${race.sex ? ` ${race.sex}` : ""}`.trim();
    try {
      report.push(`${label} : ${await placeGeneralStartList(admin, race, cache)}`);
    } catch (err) {
      report.push(`${label} : liste non placée (${err instanceof Error ? err.message : "erreur inconnue"}), tous les biathlètes cotés restent proposés`);
    }
  }
  return report.length ? `Listes de départ : ${report.join(" ; ")}.` : "Listes de départ : déjà en place.";
}
