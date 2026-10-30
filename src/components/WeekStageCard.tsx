import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { Countdown } from "@/components/Countdown";
import { PredictedBadge } from "@/components/PredictedBadge";
import { SingleResultCard } from "@/components/LastResultCard";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { displayedSex } from "@/lib/raceLabel";
import type { WeekStage } from "@/lib/weekStage";
import type { LastResult } from "@/lib/lastResult";

/**
 * Encart « L'étape de la semaine » de l'accueil : courses en cours, résultat du jour (jusqu'à
 * minuit) ou prochaine course avec compte à rebours (voir pickWeekFeature).
 */
export async function WeekStageCard({
  stage,
  result,
  nowMs,
  locale,
}: {
  stage: WeekStage;
  /** Détail du résultat du jour (stage.resultRaceId), affiché sous l'encadré. */
  result: LastResult | null;
  nowMs: number;
  locale: string;
}) {
  const [t, tFormat, tSex, tRace] = await Promise.all([
    getTranslations("Home"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getTranslations("Race"),
  ]);
  const next = stage.nextRace;

  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("weekStageTitle")}</div>
      <div className="overflow-hidden rounded-2xl border border-gold/30 bg-card">
        <Link href={`/courses?etape=${stage.id}`} className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-soft text-lg">
            {nationFlagEmoji(stage.countryCode)}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            {stage.badge && (
              <div className="w-fit rounded-full bg-gold-soft px-2 py-0.5 font-display text-[10px] font-bold uppercase text-gold">
                {t(stage.badge === "now" ? "nowBadge" : "nextRaceBadge")}
              </div>
            )}
            <div className="text-sm font-semibold">{stage.location}</div>
          </div>
          {stage.coefficient === 2 && (
            <div className="whitespace-nowrap rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
              {t("coefficientBadge")}
            </div>
          )}
          <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-text-dim" />
        </Link>

        {stage.ongoing.map((race) => (
          <Link
            key={race.id}
            href={`/courses/${race.id}`}
            className="flex flex-col gap-1 border-t border-border px-4 py-2.5"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red" />
              <span className="font-display text-[10px] font-bold uppercase text-red">{tRace("status_ongoing")}</span>
              <span className="flex-1 truncate">
                {tFormat(race.format)}
                {displayedSex(race) ? ` ${tSex(displayedSex(race)!)}` : ""}
              </span>
            </div>
            <div className="text-xs text-text-dim">
              {race.picks
                ? race.picks.map((pick) => `${nationFlagEmoji(pick.nationCode)} ${pick.name}`).join(" · ")
                : t("weekStageNoPrediction")}
            </div>
          </Link>
        ))}

        {next && (
          <Link href={`/courses/${next.id}`} className="flex items-center gap-3 border-t border-border px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-[13px] font-semibold">
                {tFormat(next.format)}
                {displayedSex(next) ? ` ${tSex(displayedSex(next)!)}` : ""}
              </div>
              <div className="text-xs text-text-dim first-letter:uppercase">
                {new Date(next.locksAt).toLocaleString(locale, {
                  timeZone: DISPLAY_TIME_ZONE,
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {next.predicted ? (
                <PredictedBadge label={tRace("predicted")} />
              ) : (
                <span className="mt-1 w-fit rounded-full bg-ice px-3 py-1 font-display text-[12px] font-bold text-on-ice">
                  {t("toPlayButton")}
                </span>
              )}
            </div>
            <div className="self-end">
              <Countdown target={next.locksAt} serverNow={nowMs} />
            </div>
          </Link>
        )}
      </div>
      {result && <SingleResultCard result={result} locale={locale} />}
    </div>
  );
}

/** Pas d'étape cette semaine : les biathlètes se reposent. */
export async function RestWeekCard() {
  const t = await getTranslations("Home");
  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("weekStageTitle")}</div>
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-2xl">🎿</div>
        <div className="text-[13px] font-semibold leading-snug text-frost">{t("restWeek")}</div>
      </div>
    </div>
  );
}
