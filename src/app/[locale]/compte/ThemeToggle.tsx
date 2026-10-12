"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MoonIcon, SunIcon } from "@/components/icons";

// Bascule thème sombre / clair : classe `light` sur <html>, mémorisée dans le navigateur
// (localStorage "theme") et réappliquée avant l'affichage par le script du layout.
export function ThemeToggle() {
  const t = useTranslations("Compte");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(!document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
    try {
      localStorage.setItem("theme", nextDark ? "dark" : "light");
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour la page en cours.
    }
  }

  return (
    <button type="button" role="switch" aria-checked={dark} onClick={toggle} className="flex w-full items-center gap-3.5 text-left">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-ice">
        {dark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="font-display text-sm font-bold">{t("appearanceTitle")}</div>
        <div className="text-[12px] text-text-dim">{dark ? t("darkTheme") : t("lightTheme")}</div>
      </div>
      <div className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${dark ? "bg-ice" : "bg-border"}`}>
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${dark ? "right-0.5" : "left-0.5"}`}
        />
      </div>
    </button>
  );
}
