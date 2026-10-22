import Papa from "papaparse";

/** Minuscules, sans accents ni espaces superflus : sert aux en-têtes comme aux valeurs libres. */
export function normalizeLabel(value: string): string {
  return value
    .replace(/^﻿/, "") // BOM laissé par Excel en tête de fichier
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .trim()
    .toLowerCase();
}

/**
 * Lit un CSV avec une ligne d'en-têtes. Séparateur détecté automatiquement
 * (virgule ou point-virgule, ce dernier étant celui d'Excel en français).
 */
export function parseCsv(csvText: string): Record<string, string>[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeLabel,
  });
  // Une ligne plus courte que l'en-tête n'est pas bloquante : les cellules manquantes valent "".
  const blocking = errors.filter((e) => e.type !== "FieldMismatch");
  if (blocking.length > 0) throw new Error(`CSV illisible : ${blocking[0].message}`);
  return data;
}

/**
 * Écrit un CSV avec le point-virgule d'Excel en français et un BOM UTF-8,
 * pour que les accents s'affichent correctement à l'ouverture dans Excel.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return "﻿" + Papa.unparse({ fields: headers, data: rows.map((r) => r.map((v) => (v == null ? "" : String(v)))) }, { delimiter: ";" });
}

/** Cote : entier strictement positif. `null` si la cellule est vide, `NaN` si elle est invalide. */
export function parseOddsCell(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isInteger(n) && n > 0 ? n : NaN;
}
