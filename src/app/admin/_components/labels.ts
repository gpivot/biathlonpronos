import { displayedSex } from "@/lib/raceLabel";
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
  { value: "brouillard", label: "Brouillard (sprint, individuelle)" },
  { value: "tes_colle", label: "T'es collé(e)" },
];

/** Formats autorisés par course spéciale (absent : tous). Brouillard : sprint ou individuelle (demande de Guillaume). */
export const SPECIAL_RULE_FORMATS: Record<string, string[]> = {
  brouillard: ["sprint", "individuel"],
};

export function isSpecialRuleAllowed(format: string, specialRule: string): boolean {
  const allowed = SPECIAL_RULE_FORMATS[specialRule];
  return !allowed || allowed.includes(format);
}

export const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

/** « Sprint Femmes », « Relais Mixte »… (le sexe des relais H/F est déjà dans le format). */
export function raceLabel(race: { format: string; sex: string | null }): string {
  const base = RACE_FORMATS.find((f) => f.value === race.format)?.label ?? race.format;
  const sex = displayedSex(race);
  return sex ? `${base} ${sex === "F" ? "Femmes" : "Hommes"}` : base;
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

/** Statut affiché dans l'admin (même règle que le Calendrier joueur, cf. getRaceDisplayStatus). */
export const RACE_STATUS_LABELS: Record<string, string> = {
  upcoming: "à venir",
  ongoing: "résultats à saisir",
  finished: "résultats saisis",
};

export const RACE_STATUS_STYLES: Record<string, string> = {
  upcoming: "border border-border text-text-dim",
  ongoing: "bg-gold-soft text-gold",
  finished: "bg-ice-soft text-ice",
};

/** Valeur d'un input datetime-local (UTC) à partir d'une date ISO. */
export function toDateTimeLocalUtc(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}
