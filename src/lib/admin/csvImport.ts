import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setCurrentOdds } from "./odds";

export interface ImportSummary {
  athletesCreated: number;
  athletesUpdated: number;
  oddsRowsWritten: number;
  warnings: string[];
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .trim()
    .toLowerCase();
}

function parseCsv(csvText: string): Record<string, string>[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });
  if (errors.length > 0) throw new Error(errors[0].message);
  return data;
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Import du fichier "femmes" ou "hommes" : une ligne par athlète —
 * nom, prénom, nationalité, globe, jeune, nation, sprint, poursuite,
 * individuel, mass, relais (colonnes confirmées par Guillaume, 2026-09-11).
 * "nation" et "relais" sont des cotes de nation répétées sur chaque athlète
 * de cette nation dans le fichier — écrites une seule fois par nation.
 */
export async function importAthleteOddsCsv(
  admin: SupabaseClient,
  seasonId: string,
  sex: "H" | "F",
  csvText: string
): Promise<ImportSummary> {
  const rows = parseCsv(csvText);
  const summary: ImportSummary = { athletesCreated: 0, athletesUpdated: 0, oddsRowsWritten: 0, warnings: [] };

  const { data: existingAthletes } = await admin
    .from("athletes")
    .select("id, first_name, last_name, nation_code")
    .eq("season_id", seasonId)
    .eq("sex", sex);

  const athleteKey = (firstName: string, lastName: string, nationCode: string) =>
    `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${nationCode.trim().toUpperCase()}`;

  const athleteIdByKey = new Map(
    (existingAthletes ?? []).map((a) => [athleteKey(a.first_name, a.last_name, a.nation_code), a.id as string])
  );

  const { data: nations } = await admin.from("nations").select("code");
  const validNationCodes = new Set((nations ?? []).map((n) => n.code));

  const relayFormat = sex === "H" ? "relais_h" : "relais_f";
  const nationOddsSeen = new Map<string, { nation: number | null; relais: number | null }>();

  for (const [index, row] of rows.entries()) {
    const lastName = row["nom"]?.trim();
    const firstName = row["prenom"]?.trim();
    const nationCode = row["nationalite"]?.trim().toUpperCase();

    if (!lastName || !firstName || !nationCode) {
      summary.warnings.push(`Ligne ${index + 2} ignorée : nom/prénom/nationalité manquant.`);
      continue;
    }
    if (!validNationCodes.has(nationCode)) {
      summary.warnings.push(`Ligne ${index + 2} (${firstName} ${lastName}) : nation "${nationCode}" inconnue.`);
      continue;
    }

    const key = athleteKey(firstName, lastName, nationCode);
    let athleteId = athleteIdByKey.get(key);

    if (!athleteId) {
      const { data: created, error } = await admin
        .from("athletes")
        .insert({ season_id: seasonId, first_name: firstName, last_name: lastName, nation_code: nationCode, sex })
        .select("id")
        .single();
      if (error || !created) {
        summary.warnings.push(`Ligne ${index + 2} (${firstName} ${lastName}) : création impossible (${error?.message}).`);
        continue;
      }
      const newAthleteId: string = created.id;
      athleteIdByKey.set(key, newAthleteId);
      athleteId = newAthleteId;
      summary.athletesCreated++;
    } else {
      summary.athletesUpdated++;
    }

    const athleteFormats: Array<[string, string]> = [
      ["sprint", "sprint"],
      ["poursuite", "poursuite"],
      ["individuel", "individuel"],
      ["mass_start", "mass"],
      ["gros_globe", "globe"],
      ["meilleur_jeune", "jeune"],
    ];
    for (const [format, column] of athleteFormats) {
      const value = toNumberOrNull(row[column]);
      if (value == null) continue;
      await setCurrentOdds(admin, { seasonId, format, athleteId, value });
      summary.oddsRowsWritten++;
    }

    // "nation"/"relais" se répètent par ligne pour une même nation — on ne
    // garde que la dernière valeur lue et on écrit une seule fois plus bas.
    nationOddsSeen.set(nationCode, {
      nation: toNumberOrNull(row["nation"]),
      relais: toNumberOrNull(row["relais"]),
    });
  }

  for (const [nationCode, values] of nationOddsSeen.entries()) {
    if (values.nation != null) {
      await setCurrentOdds(admin, {
        seasonId,
        format: "meilleure_nation",
        nationCode,
        nationSex: sex,
        value: values.nation,
      });
      summary.oddsRowsWritten++;
    }
    if (values.relais != null) {
      await setCurrentOdds(admin, { seasonId, format: relayFormat, nationCode, nationSex: sex, value: values.relais });
      summary.oddsRowsWritten++;
    }
  }

  return summary;
}

/**
 * Import du fichier "relais mixtes" : une ligne par nation — nation, mixte,
 * simple (colonnes confirmées par Guillaume, 2026-09-11).
 */
export async function importMixedRelayOddsCsv(
  admin: SupabaseClient,
  seasonId: string,
  csvText: string
): Promise<ImportSummary> {
  const rows = parseCsv(csvText);
  const summary: ImportSummary = { athletesCreated: 0, athletesUpdated: 0, oddsRowsWritten: 0, warnings: [] };

  const { data: nations } = await admin.from("nations").select("code");
  const validNationCodes = new Set((nations ?? []).map((n) => n.code));

  for (const [index, row] of rows.entries()) {
    const nationCode = row["nation"]?.trim().toUpperCase();
    if (!nationCode) {
      summary.warnings.push(`Ligne ${index + 2} ignorée : nation manquante.`);
      continue;
    }
    if (!validNationCodes.has(nationCode)) {
      summary.warnings.push(`Ligne ${index + 2} : nation "${nationCode}" inconnue.`);
      continue;
    }

    const mixte = toNumberOrNull(row["mixte"]);
    if (mixte != null) {
      await setCurrentOdds(admin, { seasonId, format: "relais_mixte", nationCode, value: mixte });
      summary.oddsRowsWritten++;
    }

    const simple = toNumberOrNull(row["simple"]);
    if (simple != null) {
      await setCurrentOdds(admin, { seasonId, format: "relais_mixte_simple", nationCode, value: simple });
      summary.oddsRowsWritten++;
    }
  }

  return summary;
}
