"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import type { RaceDisplayStatus } from "@/lib/raceStatus";

export interface CalendarRace {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
  displayStatus: RaceDisplayStatus;
}

export interface CalendarStage {
  id: string;
  location: string;
  country_code: string;
  starts_on: string;
  ends_on: string;
  coefficient: 1 | 2;
  races: CalendarRace[];
}

const STATUS_STYLES: Record<RaceDisplayStatus, string> = {
  upcoming: "border border-border text-text-dim",
  ongoing: "bg-gold-soft text-gold",
  finished: "bg-ice-soft text-ice",
};

export function CalendarAccordion({
  stages,
  defaultOpenStageId,
  locale,
}: {
  stages: CalendarStage[];
  defaultOpenStageId: string | null;
  locale: string;
}) {
  const [openStageId, setOpenStageId] = useState<string | null>(defaultOpenStageId);
  const t = useTranslations("Courses");
  const tFormat = useTranslations("RaceFormat");
  const tSex = useTranslations("Sex");
  const tRace = useTranslations("Race");

  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage) => {
        const isOpen = stage.id === openStageId;
        return (
          <div key={stage.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={() => setOpenStageId(isOpen ? null : stage.id)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-lg">
                {nationFlagEmoji(stage.country_code)}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="text-sm font-semibold">{stage.location}</div>
                <div className="text-xs text-text-dim">
                  {new Date(stage.starts_on).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  {" – "}
                  {new Date(stage.ends_on).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                </div>
              </div>
              {stage.coefficient === 2 && (
                <div className="whitespace-nowrap rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
                  {t("coefficientBadge")}
                </div>
              )}
              <ChevronDownIcon
                className={`h-4 w-4 flex-shrink-0 text-text-dim transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                {stage.races.length === 0 ? (
                  <div className="px-1.5 py-2 text-[12px] text-text-dim">{t("noRacesInStage")}</div>
                ) : (
                  stage.races.map((race) => (
                    <Link
                      key={race.id}
                      href={`/courses/${race.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3.5 py-3"
                    >
                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="text-sm font-semibold">
                          {tFormat(race.format)}
                          {race.sex ? ` ${tSex(race.sex)}` : ""}
                        </div>
                        <div className="text-xs text-text-dim">
                          {new Date(race.locks_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                          {" · "}
                          {new Date(race.locks_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${STATUS_STYLES[race.displayStatus]}`}
                      >
                        {tRace(`status_${race.displayStatus}`)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
