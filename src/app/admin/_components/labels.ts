export const RACE_FORMATS = [
  { value: "sprint", label: "Sprint" },
  { value: "poursuite", label: "Poursuite" },
  { value: "individuel", label: "Individuel" },
  { value: "mass_start", label: "Mass Start" },
  { value: "relais_h", label: "Relais Hommes" },
  { value: "relais_f", label: "Relais Femmes" },
  { value: "relais_mixte", label: "Relais Mixte" },
  { value: "relais_mixte_simple", label: "Relais Mixte Simple" },
];

export const SPECIAL_RULES = [
  { value: "", label: "Aucune" },
  { value: "tour_de_pena", label: "Tour de péna" },
  { value: "brouillard", label: "Brouillard" },
  { value: "tes_colle", label: "T'es collé(e)" },
];

export const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

/** « Sprint Femmes », « Relais Mixte »… (le sexe des relais H/F est déjà dans le format). */
export function raceLabel(race: { format: string; sex: string | null }): string {
  const base = RACE_FORMATS.find((f) => f.value === race.format)?.label ?? race.format;
  return race.sex ? `${base} ${race.sex === "F" ? "Femmes" : "Hommes"}` : base;
}

/** Heure de départ en UTC, comme saisie et importée. */
export function formatLockTime(iso: string): string {
  return (
    new Date(iso).toLocaleString("fr-FR", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  );
}

export function formatDateRange(startsOn: string, endsOn: string): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return startsOn === endsOn ? fmt(startsOn) : `${fmt(startsOn)} → ${fmt(endsOn)}`;
}

export const RACE_STATUS_LABELS: Record<string, string> = {
  upcoming: "à venir",
  locked: "verrouillée",
  finished: "résultats saisis",
};

export const RACE_STATUS_STYLES: Record<string, string> = {
  upcoming: "border border-border text-text-dim",
  locked: "bg-gold-soft text-gold",
  finished: "bg-ice-soft text-ice",
};
