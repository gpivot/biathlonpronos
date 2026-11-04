"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { BottomNavBar, NAV_ITEMS } from "./BottomNavBar";

/**
 * Barre de navigation affichée pendant le chargement d'une page (loading.tsx) : tout de suite, sans
 * lire la base, avec l'onglet de la page demandée déjà allumé.
 */
export function BottomNavLoading() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const active = NAV_ITEMS.find(({ href }) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)))?.href;
  const labels = { home: t("home"), stages: t("stages"), standings: t("standings"), leagues: t("leagues"), admin: t("admin") };
  return <BottomNavBar labels={labels} isAdmin={false} active={active} />;
}
