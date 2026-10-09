import { defineRouting } from "next-intl/routing";

/**
 * Langues actives. FR/EN sont prioritaires (marché francophone + acquisition
 * internationale) ; les langues des autres nations biathlon (DE, NO, SV, IT,
 * RU) s'ajoutent ici plus tard, chacune avec son propre fichier dans
 * messages/. Aucun autre changement de code n'est nécessaire pour en
 * activer une : next-intl route et négocie automatiquement sur cette liste.
 */
export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  localePrefix: "always",
});
