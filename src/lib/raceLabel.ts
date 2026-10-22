/**
 * Relais Hommes / Relais Femmes portent déjà le sexe dans leur libellé : afficher
 * aussi races.sex (que l'import CSV renseigne) donnerait « Relais Femmes Femmes ».
 */
const FORMATS_WITH_SEX_IN_LABEL = new Set(["relais_h", "relais_f"]);

export function displayedSex(race: { format: string; sex: string | null }): string | null {
  return race.sex && !FORMATS_WITH_SEX_IN_LABEL.has(race.format) ? race.sex : null;
}
