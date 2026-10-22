import { normalizeLabel, parseCsv, toCsv } from "./csv";

/**
 * CSV des résultats d'une course, importé dans le formulaire de saisie (`ResultsForm`) : il ne
 * fait que pré-remplir les lignes, l'admin relit puis valide pour calculer les points. Pensé pour
 * être produit par une IA à partir du classement officiel IBU.
 */
export const ATHLETE_RESULTS_HEADERS = ["Rang", "Nom", "Prénom", "Nation", "Écart (s)", "Tours de péna", "Fusée", "Gâchette"];
export const NATION_RESULTS_HEADERS = ["Rang", "Nation"];

export interface ResultsCsvCandidate {
  id: string;
  /** Athlète uniquement. */
  firstName?: string;
  lastName?: string;
  /** Code nation (athlète : sa nation ; relais : la nation elle-même). */
  nationCode: string;
  /** Relais : nom de la nation, accepté à la place du code. */
  nationName?: string;
}

export interface ParsedResultRow {
  rank: string;
  timeGapSeconds: string;
  penaltyLaps: string;
  isFusee: boolean;
  isGachette: boolean;
}

export interface ParsedResultsCsv {
  rows: Record<string, ParsedResultRow>;
  matched: number;
  warnings: string[];
}

function normalizeName(value: string): string {
  return normalizeLabel(value).replace(/[-'’.]/g, " ").replace(/\s+/g, " ").trim();
}

// L'IBU translittère les lettres nordiques et germaniques (Öberg → OEBERG, Bø → BOE).
const TRANSLITERATIONS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ø: "oe", å: "aa", æ: "ae", ß: "ss" };

/** Formes comparables d'un nom : accents retirés, et translittéré à la manière de l'IBU. */
function nameVariants(value: string): string[] {
  const transliterated = value.toLowerCase().replace(/[äöüøåæß]/g, (c) => TRANSLITERATIONS[c]);
  return [...new Set([normalizeName(value), normalizeName(transliterated)])];
}

function parseFlag(value: string | undefined): boolean {
  return ["oui", "o", "x", "1", "true", "vrai", "yes", "y"].includes(normalizeLabel(value ?? ""));
}

/** « 12.3 », « +12,3 », « 1:02.5 », « +1:02:03.4 » → secondes. `null` si vide ou illisible. */
export function parseTimeGap(value: string | undefined): number | null {
  const v = (value ?? "").trim().replace(/^\+/, "").replace(",", ".");
  if (v === "") return null;
  const parts = v.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  const seconds = parts.reduce((total, p) => total * 60 + p, 0);
  return Math.round(seconds * 10) / 10;
}

function cell(row: Record<string, string>, ...headers: string[]): string {
  for (const h of headers) {
    const v = row[h];
    if (v != null && v.trim() !== "") return v.trim();
  }
  return "";
}

export function parseResultsCsv(
  csvText: string,
  mode: "athlete" | "nation",
  candidates: ResultsCsvCandidate[]
): ParsedResultsCsv {
  const result: ParsedResultsCsv = { rows: {}, matched: 0, warnings: [] };
  const csvRows = parseCsv(csvText);

  const byName = new Map<string, ResultsCsvCandidate[]>();
  for (const c of candidates) {
    const keys =
      mode === "nation"
        ? [c.nationCode, ...(c.nationName ? [c.nationName] : [])].flatMap(nameVariants)
        : [`${c.firstName} ${c.lastName}`, `${c.lastName} ${c.firstName}`].flatMap(nameVariants);
    for (const key of new Set(keys)) byName.set(key, [...(byName.get(key) ?? []), c]);
  }

  const findByName = (label: string) => {
    const found = new Map<string, ResultsCsvCandidate>();
    for (const key of nameVariants(label)) for (const c of byName.get(key) ?? []) found.set(c.id, c);
    return [...found.values()];
  };

  csvRows.forEach((row, index) => {
    const line = `Ligne ${index + 2}`;
    const rankText = cell(row, "rang", "rank", "place", "classement");
    const rank = Number(rankText);
    if (!Number.isInteger(rank) || rank < 1) {
      // DNF, DNS, DSQ… : pas de rang, la ligne est simplement ignorée.
      if (rankText !== "") result.warnings.push(`${line} : rang « ${rankText} » ignoré.`);
      return;
    }

    let label: string;
    let found: ResultsCsvCandidate[];
    const nation = cell(row, "nation", "pays", "nat").toUpperCase();
    if (mode === "nation") {
      label = cell(row, "nation", "pays", "equipe");
      found = findByName(label);
    } else {
      const fullName = cell(row, "athlete", "nom complet");
      const lastName = cell(row, "nom");
      const firstName = cell(row, "prenom");
      label = fullName || `${firstName} ${lastName}`.trim();
      found = findByName(label);
      // Homonymes : la nation tranche.
      if (found.length > 1 && nation) found = found.filter((c) => c.nationCode === nation);
    }

    if (found.length !== 1) {
      result.warnings.push(
        found.length === 0
          ? `${line} : « ${label} » introuvable parmi les ${mode === "nation" ? "nations" : "athlètes"} ayant une cote, ignoré.`
          : `${line} : « ${label} » ambigu, ajoute la nation.`
      );
      return;
    }
    const candidate = found[0];
    if (result.rows[candidate.id]) {
      result.warnings.push(`${line} : « ${label} » déjà classé plus haut, ignoré.`);
      return;
    }

    const gap = parseTimeGap(cell(row, "ecart (s)", "ecart", "gap", "behind"));
    const gachetteFromMisses = cell(row, "fautes", "misses");
    result.rows[candidate.id] = {
      rank: String(rank),
      timeGapSeconds: gap != null ? String(gap) : rank === 1 ? "0" : "",
      penaltyLaps: cell(row, "tours de pena", "tours de penalite"),
      isFusee: parseFlag(row["fusee"]),
      isGachette: gachetteFromMisses !== "" ? Number(gachetteFromMisses) === 0 : parseFlag(row["gachette"]),
    };
    result.matched++;
  });

  return result;
}

/** Fichier modèle (et résultats déjà saisis) : une ligne par candidat ayant une cote, classés d'abord. */
export function buildResultsCsv(
  mode: "athlete" | "nation",
  candidates: ResultsCsvCandidate[],
  rows: Record<string, ParsedResultRow>
): string {
  const ordered = [...candidates].sort((a, b) => {
    const ra = Number(rows[a.id]?.rank) || Infinity;
    const rb = Number(rows[b.id]?.rank) || Infinity;
    return ra - rb;
  });
  const yesNo = (v: boolean | undefined) => (v ? "oui" : "");

  if (mode === "nation") {
    return toCsv(NATION_RESULTS_HEADERS, ordered.map((c) => [rows[c.id]?.rank, c.nationCode]));
  }
  return toCsv(
    ATHLETE_RESULTS_HEADERS,
    ordered.map((c) => {
      const r = rows[c.id];
      return [r?.rank, c.lastName, c.firstName, c.nationCode, r?.timeGapSeconds, r?.penaltyLaps, yesNo(r?.isFusee), yesNo(r?.isGachette)];
    })
  );
}
