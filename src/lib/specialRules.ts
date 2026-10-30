/** Pictos des courses malus (Ma saison, page d'une course). Libellés : RaceFormat.specialRule_<règle>. */
export const SPECIAL_RULE_ICONS: Record<string, string> = {
  tour_de_pena: "🔁",
  brouillard: "🌫️",
  tes_colle: "📉",
};

/**
 * Barème illustré de chaque malus (pop-up « ? » de la page d'une course) : un picto et une ligne
 * (Race.malusScale_<règle>_<n>).
 */
export const MALUS_SCALE: Record<string, string[]> = {
  tour_de_pena: ["🎯", "🔁", "🔁🔁🔁"],
  brouillard: ["✅", "🌫️", "🌫️"],
  tes_colle: ["😬", "😱", "💀", "🙈"],
};
