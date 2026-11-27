"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface WeekTip {
  /** Clé stable : une fois « Compris », l'astuce ne revient plus sur cet appareil. */
  key: string;
  icon: string;
  title: string;
  text: string;
}

const STORAGE_PREFIX = "bp:tip:";
const MAX_VISIBLE = 2;

/**
 * Encadré « Nouveau cette semaine » de l'étape de la semaine (27/11/2026) : explique en deux
 * phrases une règle qui entre en jeu (course spéciale, poursuite, relais, Mondiaux, étape ×0),
 * jusqu'à ce que le joueur appuie sur « Compris » (mémorisé sur l'appareil).
 */
export function WeekTips({ tips }: { tips: WeekTip[] }) {
  const t = useTranslations("Home");
  const [visible, setVisible] = useState<WeekTip[] | null>(null);

  useEffect(() => {
    const seen = (key: string) => {
      try {
        return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
      } catch {
        return false;
      }
    };
    setVisible(tips.filter((tip) => !seen(tip.key)));
  }, [tips]);

  if (!visible || visible.length === 0) return null;

  const dismiss = (key: string) => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on masque seulement pour cette visite.
    }
    setVisible((prev) => (prev ?? []).filter((tip) => tip.key !== key));
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-ice-soft/60 px-4 py-3">
      <div className="font-display text-[11px] font-bold uppercase tracking-wider text-ice">✨ {t("weekTipsTitle")}</div>
      {visible.slice(0, MAX_VISIBLE).map((tip) => (
        <div key={tip.key} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="font-display text-[13px] font-extrabold">
            {tip.icon} {tip.title}
          </div>
          <p className="text-[12px] leading-relaxed text-text-dim">{tip.text}</p>
          <div className="flex items-center justify-between gap-2">
            <Link href="/regles" className="font-display text-[12px] font-bold text-ice">
              {t("weekTipsRules")} →
            </Link>
            <button
              type="button"
              onClick={() => dismiss(tip.key)}
              className="rounded-full bg-ice px-3 py-1 font-display text-[12px] font-bold text-on-ice"
            >
              {t("weekTipsGotIt")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
