import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { displayedSex } from "@/lib/raceLabel";
import type { WeekStage } from "@/lib/weekStage";

/** Encart « L'étape de la semaine » de l'accueil. */
export async function WeekStageCard({ stage }: { stage: WeekStage }) {
  const [t, tFormat, tSex, tRace] = await Promise.all([
    getTranslations("Home"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getTranslations("Race"),
  ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("weekStageTitle")}</div>
      <div className="overflow-hidden rounded-2xl border border-gold/30 bg-card">
        <Link href={`/pronos?etape=${stage.id}`} className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-soft text-lg">
            {nationFlagEmoji(stage.countryCode)}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            {stage.raceToday && (
              <div className="w-fit rounded-full bg-gold-soft px-2 py-0.5 font-display text-[10px] font-bold uppercase text-gold">
                {t("nowBadge")}
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

        {stage.toPlay && (
          <div className="border-t border-border px-4 py-3">
            <Link
              href={`/courses/${stage.toPlay.id}`}
              className="flex items-center justify-center gap-1.5 rounded-full bg-ice py-2.5 font-display text-[13px] font-bold text-on-ice"
            >
              {t("toPlayButton")} ·{" "}
              {tFormat(stage.toPlay.format)}
              {displayedSex(stage.toPlay) ? ` ${tSex(displayedSex(stage.toPlay)!)}` : ""}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
