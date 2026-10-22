"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";

export interface PronosRace {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
  /** "open" : ouverte au pronostic, rien de validé. "predicted" : pronostic déjà déposé. */
  kind: "open" | "predicted";
  names?: string;
  points?: number | null;
}

export interface PronosStage {
  id: string;
  location: string;
  country_code: string;
  starts_on: string;
  ends_on: string;
  coefficient: 1 | 2;
  races: PronosRace[];
}

export function PronosAccordion({
  stages,
  locale,
}: {
  stages: PronosStage[];
  locale: string;
}) {
  // Toutes les étapes sont repliées à l'arrivée sur l'onglet.
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const t = useTranslations("Pronos");
  const tCourses = useTranslations("Courses");
  const tFormat = useTranslations("RaceFormat");
  const tSex = useTranslations("Sex");

  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage) => {
        const isOpen = stage.id === openStageId;
        const toPredictCount = stage.races.filter((r) => r.kind === "open").length;
        // Championnats du monde (coefficient 2) : encart doré, comme dans le Calendrier.
        const isChampionship = stage.coefficient === 2;

        return (
          <div
            key={stage.id}
            className={`overflow-hidden rounded-2xl border ${
              isChampionship
                ? "border-gold/60 bg-gradient-to-br from-gold/25 to-card shadow-[0_0_24px_-8px_oklch(0.84_0.15_90/0.5)]"
                : "border-border bg-card"
            }`}
          >
            <button
              onClick={() => setOpenStageId(isOpen ? null : stage.id)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg ${
                  isChampionship ? "bg-gold/20" : "bg-ice-soft"
                }`}
              >
                {nationFlagEmoji(stage.country_code)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {isChampionship && (
                  <div className="font-display text-[10px] font-bold uppercase tracking-wider text-gold">
                    {tCourses("worldChampionships")} · {tCourses("coefficientBadge")}
                  </div>
                )}
                <div className={`text-sm font-semibold ${isChampionship ? "text-gold" : ""}`}>{stage.location}</div>
                <div className="text-xs text-text-dim">
                  {new Date(stage.starts_on).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" })}
                  {" – "}
                  {new Date(stage.ends_on).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" })}
                </div>
              </div>
              {toPredictCount > 0 && (
                <div className="whitespace-nowrap rounded-full bg-ice-soft px-2.5 py-1 font-display text-[11px] font-bold text-ice">
                  {t("toPredictCount", { count: toPredictCount })}
                </div>
              )}
              <ChevronDownIcon
                className={`h-4 w-4 flex-shrink-0 text-text-dim transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className={`flex flex-col gap-2 border-t px-3 py-3 ${isChampionship ? "border-gold/30" : "border-border"}`}>
                {stage.races.map((race) => (
                  <Link
                    key={race.id}
                    href={`/courses/${race.id}`}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                      race.kind === "open" ? "border-ice/40 bg-ice-soft" : "border-border bg-bg"
                    }`}
                  >
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="text-sm font-semibold">
                        {tFormat(race.format)}
                        {race.sex ? ` ${tSex(race.sex)}` : ""}
                      </div>
                      <div className="text-xs text-text-dim">
                        {race.kind === "predicted" && race.names
                          ? race.names
                          : new Date(race.locks_at).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" })}
                      </div>
                    </div>
                    {race.kind === "open" ? (
                      <div className="whitespace-nowrap font-display text-[11px] font-bold text-ice">
                        {t("toPredictLabel")}
                      </div>
                    ) : race.points != null ? (
                      <div className="whitespace-nowrap font-display text-sm font-bold text-ice">{race.points} pts</div>
                    ) : (
                      <div className="whitespace-nowrap rounded-full bg-gold-soft px-2.5 py-1 font-display text-[10px] font-bold uppercase text-gold">
                        {t("pendingLabel")}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
