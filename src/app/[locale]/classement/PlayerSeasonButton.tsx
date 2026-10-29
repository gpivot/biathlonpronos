"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { CalendarAccordion } from "../courses/CalendarAccordion";
import { SeasonPredictionsAccordion } from "../courses/SeasonPredictionsAccordion";
import { getPlayerSeason, type PlayerSeason } from "./actions";

/**
 * Ligne du Classement cliquable : ouvre un pop-up avec la page « Ma saison » du joueur
 * (pronostics de saison repliés, puis ses pronostics d'étapes), en lecture seule.
 */
export function PlayerSeasonButton({ userId, className, children }: { userId: string; className: string; children: ReactNode }) {
  const t = useTranslations("Classement");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PlayerSeason | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const show = async () => {
    setOpen(true);
    if (data) return;
    setState("loading");
    try {
      const result = await getPlayerSeason(userId);
      setData(result);
      setState(result ? "idle" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <button type="button" onClick={show} className={`w-full text-left ${className}`}>
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={data?.pseudo ?? t("playerTitle")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-t-2xl border border-border bg-bg p-4 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-base font-bold">{data?.pseudo ?? t("playerTitle")}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-dim"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto">
              {state === "loading" && <div className="py-6 text-center text-[13px] text-text-dim">{t("playerLoading")}</div>}
              {state === "error" && <div className="py-6 text-center text-[13px] text-text-dim">{t("playerError")}</div>}
              {data && (
                <>
                  {data.seasonPicks && <SeasonPredictionsAccordion picks={data.seasonPicks} readOnly />}
                  <div className="text-[11px] text-text-dim">{t("playerHiddenHint")}</div>
                  <CalendarAccordion stages={data.stages} defaultOpenStageId={data.defaultOpenStageId} locale={locale} readOnly />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
