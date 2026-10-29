"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const NAV_COUNT_KEY = "bp:nav-count";

/**
 * Compte les pages vues dans l'onglet (sessionStorage) pour que BackButton sache s'il y a une
 * page précédente sur le site. `document.referrer` ne suit pas les navigations côté client.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(NAV_COUNT_KEY, String(Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? 0) + 1));
    } catch {
      // Stockage indisponible (navigation privée stricte) : BackButton retombe sur son lien par défaut.
    }
  }, [pathname]);
  return null;
}
