"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";

export interface SeasonPick {
  key: string;
  /** Clé de traduction : Globes.category_* ou Courses.pepite_F / pepite_H. */
  labelKey: string;
  /** null : pas encore choisi. */
  name: string | null;
  nationCode: string | null;
}

/**
 * « Mes pronostics de saison » (globes et Pépites), replié par défaut en haut du Calendrier.
 * `readOnly` : ceux d'un autre joueur (pop-up du Classement), sans lien de modification.
 */
export function SeasonPredictionsAccordion({ picks, readOnly = false }: { picks: SeasonPick[]; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Courses");
  const tGlobes = useTranslations("Globes");
  const chosen = picks.filter((p) => p.name).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-soft text-lg">🏆</div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">{readOnly ? t("seasonPredictionsTitleOther") : t("seasonPredictionsTitle")}</div>
          <div className="text-xs text-text-dim">{t("seasonPredictionsCount", { chosen, total: picks.length })}</div>
        </div>
        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-text-dim transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {picks.map((pick) => (
            <div key={pick.key} className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5">
              <div className="flex-1 text-[13px] text-text-dim">
                {pick.labelKey.startsWith("category_") ? tGlobes(pick.labelKey) : `❄️ ${t(pick.labelKey)}`}
              </div>
              {pick.name ? (
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {pick.nationCode && <span>{nationFlagEmoji(pick.nationCode)}</span>}
                  {pick.name}
                </div>
              ) : (
                <div className="text-[12px] text-text-dim">{t("seasonPredictionsNone")}</div>
              )}
            </div>
          ))}
          {!readOnly && (
            <Link
              href="/globes"
              className="rounded-full border border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-ice"
            >
              {t("seasonPredictionsLink")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
