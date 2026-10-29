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

/** Remplace la liste de départ enregistrée de la course. */
export async function saveStartList(admin: SupabaseClient, raceId: string, rows: MatchedStartList["rows"]): Promise<void> {
  const { error: deleteError } = await admin.from("race_start_lists").delete().eq("race_id", raceId);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length === 0) return;
  const { error } = await admin
    .from("race_start_lists")
    .insert(rows.map((r) => ({ race_id: raceId, athlete_id: r.athleteId, start_position: r.position, bib: r.bib })));
  if (error) throw new Error(error.message);
}
