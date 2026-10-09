import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alpha2ToAlpha3, NATION_NAMES } from "@/lib/nationFlags";

export interface CalendarImportSummary {
  stagesCreated: number;
  stagesUpdated: number;
  racesCreated: number;
  racesUpdated: number;
  warnings: string[];
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .trim()
    .toLowerCase();
}

const FORMAT_LABELS: Record<string, string> = {
  individuel: "individuel",
  sprint: "sprint",
  poursuite: "poursuite",
  "mass-start": "mass_start",
  "mass start": "mass_start",
  relais: "relais", // désambiguïsé plus bas avec le sexe (relais_h / relais_f)
  "relais mixte simple": "relais_mixte_simple",
  "relais mixte": "relais_mixte",
};

const SEX_LABELS: Record<string, "H" | "F" | null> = {
  hommes: "H",
  femmes: "F",
  mixte: null,
};

function resolveRaceFormat(typeLabel: string, sex: "H" | "F" | null): string | null {
  const base = FORMAT_LABELS[typeLabel.trim().toLowerCase()];
  if (!base) return null;
  if (base === "relais") return sex === "H" ? "relais_h" : sex === "F" ? "relais_f" : null;
  return base;
}

interface CalendarRow {
  location: string;
  countryAlpha2: string;
  date: string;
  time: string;
  category: string;
  typeLabel: string;
  sexLabel: string;
  lineNumber: number;
}

/**
 * Import du calendrier de saison : une ligne = une course. Les lignes
 * partageant le même lieu forment une étape (dates min/max, coefficient ×2
 * si "Championnats du Monde"/JO). Ré-exécutable sans dupliquer : étape
 * retrouvée par (season_id, location), course par (stage_id, format, sex).
 * Colonnes attendues : Lieu (ville), Pays (pour code drapeau) [alpha-2],
 * Date, Heure de départ UTC, Catégorie, Type de course, Sexe.
 */
export async function importCalendarCsv(
  admin: SupabaseClient,
  seasonId: string,
  csvText: string
): Promise<CalendarImportSummary> {
  const { data: rows, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });
  if (errors.length > 0) throw new Error(errors[0].message);

  const summary: CalendarImportSummary = {
    stagesCreated: 0,
    stagesUpdated: 0,
    racesCreated: 0,
    racesUpdated: 0,
    warnings: [],
  };

  const { data: existingNations } = await admin.from("nations").select("code");
  const knownNationCodes = new Set((existingNations ?? []).map((n) => n.code as string));

  const { data: existingStages } = await admin.from("stages").select("id, location").eq("season_id", seasonId);
  const stageIdByLocation = new Map(
    (existingStages ?? []).map((s) => [(s.location as string).trim().toLowerCase(), s.id as string])
  );

  const grouped = new Map<string, CalendarRow[]>();

  (rows ?? []).forEach((row, index) => {
    const lineNumber = index + 2;
    const location = row["lieu (ville)"]?.trim();
    const countryAlpha2 = row["pays (pour code drapeau)"]?.trim();
    const date = row["date"]?.trim();
    const time = row["heure de depart utc"]?.trim();
    const category = row["categorie"]?.trim() ?? "";
    const typeLabel = row["type de course"]?.trim();
    const sexLabel = row["sexe"]?.trim();

    if (!location || !countryAlpha2 || !date || !time || !typeLabel || !sexLabel) {
      summary.warnings.push(`Ligne ${lineNumber} ignorée : colonne manquante.`);
      return;
    }

    const key = location.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ location, countryAlpha2, date, time, category, typeLabel, sexLabel, lineNumber });
  });

  for (const stageRows of grouped.values()) {
    const location = stageRows[0].location;
    const nationCode = alpha2ToAlpha3(stageRows[0].countryAlpha2);

    if (!nationCode) {
      summary.warnings.push(`Étape "${location}" ignorée : code pays "${stageRows[0].countryAlpha2}" inconnu.`);
      continue;
    }

    if (!knownNationCodes.has(nationCode)) {
      const { error } = await admin.from("nations").insert({ code: nationCode, name: NATION_NAMES[nationCode] ?? nationCode });
      if (!error) knownNationCodes.add(nationCode);
    }

    const dates = stageRows.map((r) => r.date).sort();
    const startsOn = dates[0];
    const endsOn = dates[dates.length - 1];
    const coefficient = stageRows.some((r) => /championnats|jeux olympiques|\bjo\b/i.test(r.category)) ? 2 : 1;

    let stageId = stageIdByLocation.get(location.toLowerCase());
    if (stageId) {
      await admin
        .from("stages")
        .update({ country_code: nationCode, starts_on: startsOn, ends_on: endsOn, coefficient })
        .eq("id", stageId);
      summary.stagesUpdated++;
    } else {
      const { data: created, error } = await admin
        .from("stages")
        .insert({ season_id: seasonId, location, country_code: nationCode, starts_on: startsOn, ends_on: endsOn, coefficient })
        .select("id")
        .single();
      if (error || !created) {
        summary.warnings.push(`Étape "${location}" : création impossible (${error?.message}).`);
        continue;
      }
      stageId = created.id as string;
      stageIdByLocation.set(location.toLowerCase(), stageId);
      summary.stagesCreated++;
    }

    const { data: existingRaces } = await admin.from("races").select("id, format, sex").eq("stage_id", stageId);
    const raceIdByKey = new Map(
      (existingRaces ?? []).map((r) => [`${r.format}|${r.sex ?? "null"}`, r.id as string])
    );

    for (const row of stageRows) {
      const sex = SEX_LABELS[row.sexLabel.toLowerCase()];
      if (sex === undefined) {
        summary.warnings.push(`Ligne ${row.lineNumber} ignorée : sexe "${row.sexLabel}" inconnu.`);
        continue;
      }
      const format = resolveRaceFormat(row.typeLabel, sex);
      if (!format) {
        summary.warnings.push(`Ligne ${row.lineNumber} ignorée : type de course "${row.typeLabel}" inconnu.`);
        continue;
      }

      const locksAt = `${row.date}T${row.time}:00Z`;
      const raceKey = `${format}|${sex ?? "null"}`;
      const existingRaceId = raceIdByKey.get(raceKey);

      if (existingRaceId) {
        await admin.from("races").update({ locks_at: locksAt }).eq("id", existingRaceId);
        summary.racesUpdated++;
      } else {
        const { error } = await admin.from("races").insert({ stage_id: stageId, sex, format, locks_at: locksAt });
        if (error) {
          summary.warnings.push(`Ligne ${row.lineNumber} : création impossible (${error.message}).`);
          continue;
        }
        summary.racesCreated++;
      }
    }
  }

  return summary;
}
