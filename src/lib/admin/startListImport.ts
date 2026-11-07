import type { SupabaseClient } from "@supabase/supabase-js";
import { nameVariants } from "./resultsCsv";
import type { IbuStartEntry } from "./ibuResults";

export interface StartListCandidate {
  id: string;
  firstName: string;
  lastName: string;
  nationCode: string;
}

export interface MatchedStartList {
  rows: { athleteId: string; position: number; bib: number | null }[];
  /** Biathlètes de la liste IBU sans cote dans le jeu (ou introuvables) : non pronostiquables. */
  unmatched: string[];
}

/**
 * Partie pure (testée) : rapproche la liste IBU des biathlètes qui ont une cote pour ce format
 * (même comparaison des noms que l'import des résultats). Les cotes ne sont pas touchées : la
 * course reprend celles déjà validées.
 */
export function matchStartList(entries: IbuStartEntry[], candidates: StartListCandidate[]): MatchedStartList {
  const byName = new Map<string, StartListCandidate[]>();
  for (const c of candidates) {
    const keys = [`${c.firstName} ${c.lastName}`, `${c.lastName} ${c.firstName}`].flatMap(nameVariants);
    for (const key of new Set(keys)) byName.set(key, [...(byName.get(key) ?? []), c]);
  }

  const result: MatchedStartList = { rows: [], unmatched: [] };
  const taken = new Set<string>();
  for (const entry of entries) {
    const label = `${entry.firstName} ${entry.lastName}`.trim();
    const found = new Map<string, StartListCandidate>();
    for (const key of nameVariants(label)) for (const c of byName.get(key) ?? []) found.set(c.id, c);
    let matches = [...found.values()];
    // Homonymes : la nation tranche.
    if (matches.length > 1) matches = matches.filter((c) => c.nationCode === entry.nation);
    if (matches.length !== 1 || taken.has(matches[0].id)) {
      result.unmatched.push(`${label} (${entry.nation})`);
      continue;
    }
    taken.add(matches[0].id);
    result.rows.push({ athleteId: matches[0].id, position: entry.position, bib: entry.bib });
  }
  return result;
}

/** Remplace la liste de départ enregistrée de la course (officielle IBU par défaut, ou top 60 du général). */
export async function saveStartList(
  admin: SupabaseClient,
  raceId: string,
  rows: MatchedStartList["rows"],
  source: "ibu" | "general" = "ibu"
): Promise<void> {
  const { error: deleteError } = await admin.from("race_start_lists").delete().eq("race_id", raceId);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length === 0) return;
  const { error } = await admin
    .from("race_start_lists")
    .insert(rows.map((r) => ({ race_id: raceId, athlete_id: r.athleteId, start_position: r.position, bib: r.bib, source })));
  if (error) throw new Error(error.message);
}

/** Relais : remplace les nations proposées de la course. */
export async function saveStartNations(
  admin: SupabaseClient,
  raceId: string,
  rows: { nation: string; position: number }[],
  source: "ibu" | "general" = "ibu"
): Promise<void> {
  const { error: deleteError } = await admin.from("race_start_nations").delete().eq("race_id", raceId);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length === 0) return;
  const { error } = await admin
    .from("race_start_nations")
    .insert(rows.map((r) => ({ race_id: raceId, nation_code: r.nation, start_position: r.position, source })));
  if (error) throw new Error(error.message);
}

/**
 * Partie pure (testée) : garde les nations de la liste qui ont une cote pour ce relais, dans
 * l'ordre de la liste (doublons retirés, positions renumérotées).
 */
export function matchStartNations(
  entries: { nation: string }[],
  oddsNations: string[]
): { rows: { nation: string; position: number }[]; unmatched: string[] } {
  const known = new Set(oddsNations);
  const seen = new Set<string>();
  const rows: { nation: string; position: number }[] = [];
  const unmatched: string[] = [];
  for (const { nation } of entries) {
    if (!nation || seen.has(nation)) continue;
    seen.add(nation);
    if (known.has(nation)) rows.push({ nation, position: rows.length + 1 });
    else unmatched.push(nation);
  }
  return { rows, unmatched };
}
