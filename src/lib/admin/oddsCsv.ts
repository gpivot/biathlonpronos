import type { SupabaseClient } from "@supabase/supabase-js";
import { NATION_NAMES } from "../nationFlags";
import { normalizeLabel, parseCsv, parseOddsCell, toCsv } from "./csv";

/**
 * Fichier unique des cotes d'une saison (format demandé par Guillaume, octobre 2026). Pour chaque
 * nation, dans cet ordre :
 *   1. ligne « Nation » : cotes des relais mixtes ;
 *   2. ligne « Équipe » F : cote relais femmes + meilleure nation femmes ;
 *   3. une ligne « Athlète » par athlète féminine ;
 *   4. ligne « Équipe » H puis une ligne « Athlète » par athlète masculin.
 * L'ordre sert la lisibilité : l'import se fie aux colonnes Type et Sexe, pas à la position.
 */
export const ODDS_CSV_HEADERS = [
  "Type",
  "Nation",
  "Sexe",
  "Nom",
  "Prénom",
  "Relais mixte",
  "Relais mixte simple",
  "Relais",
  "Meilleure nation",
  "Sprint",
  "Poursuite",
  "Individuel",
  "Mass start",
  "Globe",
  "Jeune",
] as const;

type Sex = "H" | "F";
type RowKind = "nation" | "equipe" | "athlete";

/** Colonnes de cotes autorisées pour chaque type de ligne : [en-tête normalisé, format en base]. */
const COLUMNS_BY_KIND: Record<RowKind, Array<[string, string]>> = {
  nation: [
    ["relais mixte", "relais_mixte"],
    ["relais mixte simple", "relais_mixte_simple"],
  ],
  equipe: [
    ["relais", "relais_team"], // relais_f ou relais_h selon le sexe de la ligne
    ["meilleure nation", "meilleure_nation"],
  ],
  athlete: [
    ["sprint", "sprint"],
    ["poursuite", "poursuite"],
    ["individuel", "individuel"],
    ["mass start", "mass_start"],
    ["globe", "gros_globe"],
    ["jeune", "meilleur_jeune"],
  ],
};

const ALL_ODDS_COLUMNS = Object.values(COLUMNS_BY_KIND).flatMap((cols) => cols.map(([header]) => header));

export interface ParsedAthlete {
  firstName: string;
  lastName: string;
  nationCode: string;
  sex: Sex;
  odds: Array<{ format: string; value: number }>;
}

export interface ParsedNationOdds {
  nationCode: string;
  /** null pour les relais mixtes (une seule équipe par nation). */
  nationSex: Sex | null;
  format: string;
  value: number;
}

export interface ParsedOddsCsv {
  athletes: ParsedAthlete[];
  nationOdds: ParsedNationOdds[];
  /** Bloquantes : rien n'est écrit tant qu'il en reste. */
  errors: string[];
  warnings: string[];
}

export function parseSex(value: string | undefined): Sex | null {
  const v = normalizeLabel(value ?? "");
  if (["f", "femme", "femmes", "dames", "w"].includes(v)) return "F";
  if (["h", "homme", "hommes", "m"].includes(v)) return "H";
  return null;
}

function parseKind(row: Record<string, string>): RowKind | null {
  const v = normalizeLabel(row["type"] ?? "");
  if (v === "nation" || v === "pays") return "nation";
  if (v === "equipe") return "equipe";
  if (v === "athlete") return "athlete";
  if (v !== "") return null;
  // Colonne Type vide : déduite du contenu de la ligne.
  if ((row["nom"] ?? "").trim() !== "") return "athlete";
  if ((row["sexe"] ?? "").trim() !== "") return "equipe";
  return "nation";
}

export function athleteKey(firstName: string, lastName: string, nationCode: string, sex: string): string {
  return `${normalizeLabel(firstName)}|${normalizeLabel(lastName)}|${nationCode.toUpperCase()}|${sex}`;
}

/** Lecture et validation du fichier, sans accès à la base. */
export function parseOddsCsv(csvText: string): ParsedOddsCsv {
  const result: ParsedOddsCsv = { athletes: [], nationOdds: [], errors: [], warnings: [] };
  const rows = parseCsv(csvText);

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    for (const required of ["nation", "sexe", "nom", "prenom"]) {
      if (!headers.includes(required)) result.errors.push(`Colonne « ${required} » absente de l'en-tête.`);
    }
    if (result.errors.length > 0) return result;
  }

  const seenAthletes = new Set<string>();
  const seenNationOdds = new Set<string>();

  rows.forEach((row, index) => {
    const line = `Ligne ${index + 2}`;
    const kind = parseKind(row);
    if (!kind) {
      result.errors.push(`${line} : type « ${row["type"]} » inconnu (attendu : Nation, Équipe ou Athlète).`);
      return;
    }

    const nationCode = (row["nation"] ?? "").trim().toUpperCase();
    if (!nationCode) {
      result.errors.push(`${line} : code nation manquant.`);
      return;
    }

    const sex = parseSex(row["sexe"]);
    if (kind !== "nation" && !sex) {
      result.errors.push(`${line} : sexe « ${row["sexe"] ?? ""} » invalide (attendu : F ou H).`);
      return;
    }

    const odds: Array<{ format: string; value: number }> = [];
    const allowed = new Set(COLUMNS_BY_KIND[kind].map(([header]) => header));
    for (const [header, format] of COLUMNS_BY_KIND[kind]) {
      const value = parseOddsCell(row[header]);
      if (value === null) continue;
      if (Number.isNaN(value)) {
        result.errors.push(`${line} : cote « ${row[header]} » invalide en colonne ${header} (entier positif attendu).`);
        continue;
      }
      odds.push({ format: format === "relais_team" ? (sex === "F" ? "relais_f" : "relais_h") : format, value });
    }
    const ignored = ALL_ODDS_COLUMNS.filter((h) => !allowed.has(h) && (row[h] ?? "").trim() !== "");
    if (ignored.length > 0) {
      result.warnings.push(`${line} : colonne(s) ${ignored.join(", ")} ignorée(s) sur une ligne ${kind}.`);
    }

    if (kind === "athlete") {
      const lastName = (row["nom"] ?? "").trim();
      const firstName = (row["prenom"] ?? "").trim();
      if (!lastName || !firstName) {
        result.errors.push(`${line} : nom ou prénom manquant.`);
        return;
      }
      const key = athleteKey(firstName, lastName, nationCode, sex!);
      if (seenAthletes.has(key)) {
        result.errors.push(`${line} : ${firstName} ${lastName} (${nationCode}) apparaît deux fois.`);
        return;
      }
      seenAthletes.add(key);
      result.athletes.push({ firstName, lastName, nationCode, sex: sex!, odds });
      return;
    }

    const nationSex = kind === "nation" ? null : sex;
    for (const o of odds) {
      const key = `${nationCode}|${nationSex}|${o.format}`;
      if (seenNationOdds.has(key)) {
        result.errors.push(`${line} : cote ${o.format} de ${nationCode} déjà donnée plus haut.`);
        continue;
      }
      seenNationOdds.add(key);
      result.nationOdds.push({ nationCode, nationSex, format: o.format, value: o.value });
    }
  });

  if (result.errors.length === 0 && result.athletes.length === 0 && result.nationOdds.length === 0) {
    result.errors.push("Le fichier ne contient aucune cote.");
  }
  return result;
}

export interface OddsImportResult {
  status: "success" | "error";
  errors: string[];
  warnings: string[];
  athletesCreated: number;
  athletesMatched: number;
  oddsWritten: number;
  oddsReplaced: number;
}

/**
 * Remplace toutes les cotes courantes de la saison par celles du fichier : les anciennes sont
 * historisées (valid_until), pas supprimées. Les athlètes absents du fichier restent en base
 * (ils peuvent figurer dans des pronostics ou des résultats) mais n'ont plus de cote, donc ne
 * sont plus proposés. Rien n'est écrit si le fichier contient une erreur.
 */
export async function replaceOddsFromCsv(
  admin: SupabaseClient,
  seasonId: string,
  csvText: string
): Promise<OddsImportResult> {
  const parsed = parseOddsCsv(csvText);
  const result: OddsImportResult = {
    status: "error",
    errors: parsed.errors,
    warnings: parsed.warnings,
    athletesCreated: 0,
    athletesMatched: 0,
    oddsWritten: 0,
    oddsReplaced: 0,
  };
  if (parsed.errors.length > 0) return result;

  // Nations : celles absentes de la table sont créées si leur nom est connu, sinon erreur.
  const { data: nations } = await admin.from("nations").select("code");
  const knownCodes = new Set((nations ?? []).map((n) => n.code as string));
  const usedCodes = new Set([...parsed.athletes.map((a) => a.nationCode), ...parsed.nationOdds.map((o) => o.nationCode)]);
  const missing = [...usedCodes].filter((code) => !knownCodes.has(code));
  const unknown = missing.filter((code) => !NATION_NAMES[code]);
  if (unknown.length > 0) {
    result.errors.push(`Nation(s) inconnue(s) : ${unknown.join(", ")}. Ajoute-les d'abord (code alpha-3, ex. FRA).`);
    return result;
  }
  if (missing.length > 0) {
    const { error } = await admin.from("nations").insert(missing.map((code) => ({ code, name: NATION_NAMES[code] })));
    if (error) return { ...result, errors: [`Création des nations impossible : ${error.message}`] };
  }

  // Athlètes : retrouvés par prénom + nom + nation + sexe (sans tenir compte des accents ni de la casse).
  const { data: existing } = await admin
    .from("athletes")
    .select("id, first_name, last_name, nation_code, sex")
    .eq("season_id", seasonId);
  const idByKey = new Map(
    (existing ?? []).map((a) => [athleteKey(a.first_name, a.last_name, a.nation_code, a.sex), a.id as string])
  );

  const toCreate = parsed.athletes.filter((a) => !idByKey.has(athleteKey(a.firstName, a.lastName, a.nationCode, a.sex)));
  result.athletesMatched = parsed.athletes.length - toCreate.length;
  if (toCreate.length > 0) {
    const { data: created, error } = await admin
      .from("athletes")
      .insert(
        toCreate.map((a) => ({
          season_id: seasonId,
          first_name: a.firstName,
          last_name: a.lastName,
          nation_code: a.nationCode,
          sex: a.sex,
        }))
      )
      .select("id, first_name, last_name, nation_code, sex");
    if (error || !created) return { ...result, errors: [`Création des athlètes impossible : ${error?.message}`] };
    for (const a of created) idByKey.set(athleteKey(a.first_name, a.last_name, a.nation_code, a.sex), a.id);
    result.athletesCreated = created.length;
  }

  const newOdds = [
    ...parsed.athletes.flatMap((a) =>
      a.odds.map((o) => ({
        season_id: seasonId,
        format: o.format,
        value: o.value,
        athlete_id: idByKey.get(athleteKey(a.firstName, a.lastName, a.nationCode, a.sex))!,
        nation_code: null,
        nation_sex: null,
      }))
    ),
    ...parsed.nationOdds.map((o) => ({
      season_id: seasonId,
      format: o.format,
      value: o.value,
      athlete_id: null,
      nation_code: o.nationCode,
      nation_sex: o.nationSex,
    })),
  ];

  // Historise toutes les cotes courantes de la saison, puis insère les nouvelles. En cas d'échec
  // de l'insertion, on remet les anciennes en place (même horodatage d'expiration).
  const expiredAt = new Date().toISOString();
  const { data: expired, error: expireError } = await admin
    .from("odds")
    .update({ valid_until: expiredAt })
    .eq("season_id", seasonId)
    .is("valid_until", null)
    .select("id");
  if (expireError) return { ...result, errors: [`Remplacement des cotes impossible : ${expireError.message}`] };

  const { error: insertError } = await admin.from("odds").insert(newOdds);
  if (insertError) {
    await admin.from("odds").update({ valid_until: null }).eq("season_id", seasonId).eq("valid_until", expiredAt);
    return { ...result, errors: [`Écriture des cotes impossible, anciennes cotes conservées : ${insertError.message}`] };
  }

  return { ...result, status: "success", oddsWritten: newOdds.length, oddsReplaced: expired?.length ?? 0 };
}

export interface OddsExportData {
  nations: Array<{ code: string; name: string }>;
  athletes: Array<{ id: string; first_name: string; last_name: string; nation_code: string; sex: string }>;
  odds: Array<{ format: string; value: number; athlete_id: string | null; nation_code: string | null; nation_sex: string | null }>;
}

/** Cotes courantes de la saison, au format de l'import (réimportable tel quel). */
export function buildOddsCsv({ nations, athletes, odds }: OddsExportData): string {
  const athleteOdds = new Map<string, Record<string, number>>();
  const nationOdds = new Map<string, Record<string, number>>(); // clé : code|sexe ("" pour mixte)
  for (const o of odds) {
    if (o.athlete_id) {
      athleteOdds.set(o.athlete_id, { ...athleteOdds.get(o.athlete_id), [o.format]: o.value });
    } else if (o.nation_code) {
      const key = `${o.nation_code}|${o.nation_sex ?? ""}`;
      nationOdds.set(key, { ...nationOdds.get(key), [o.format]: o.value });
    }
  }

  // Seuls les athlètes ayant au moins une cote courante font partie du fichier « en cours ».
  const withOdds = athletes.filter((a) => athleteOdds.has(a.id));
  const codes = new Set([...withOdds.map((a) => a.nation_code), ...[...nationOdds.keys()].map((k) => k.split("|")[0])]);
  const nameByCode = new Map(nations.map((n) => [n.code, n.name]));
  const sortedCodes = [...codes].sort((a, b) => (nameByCode.get(a) ?? a).localeCompare(nameByCode.get(b) ?? b, "fr"));

  const rows: Array<Array<string | number | undefined>> = [];
  for (const code of sortedCodes) {
    const mixed = nationOdds.get(`${code}|`) ?? {};
    rows.push(["Nation", code, "", "", "", mixed.relais_mixte, mixed.relais_mixte_simple]);

    for (const sex of ["F", "H"] as const) {
      const team = nationOdds.get(`${code}|${sex}`) ?? {};
      const members = withOdds
        .filter((a) => a.nation_code === code && a.sex === sex)
        .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"));
      if (members.length === 0 && Object.keys(team).length === 0) continue;

      rows.push(["Équipe", code, sex, "", "", "", "", team[sex === "F" ? "relais_f" : "relais_h"], team.meilleure_nation]);
      for (const a of members) {
        const o = athleteOdds.get(a.id)!;
        rows.push(["Athlète", code, sex, a.last_name, a.first_name, "", "", "", "", o.sprint, o.poursuite, o.individuel, o.mass_start, o.gros_globe, o.meilleur_jeune]);
      }
    }
  }

  return toCsv([...ODDS_CSV_HEADERS], rows);
}
