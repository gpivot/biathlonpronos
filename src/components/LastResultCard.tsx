import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { displayedSex } from "@/lib/raceLabel";
import type { LastResult } from "@/lib/lastResult";
import { PredictionBreakdown, formatPoints } from "@/components/PredictionBreakdown";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Encart « Dernier résultat » de l'accueil, façon VéloPronos ; « Derniers
 * résultats » quand plusieurs courses ont été notées le même jour.
 */
export async function LastResultCard({ results, locale }: { results: LastResult[]; locale: string }) {
  const t = await getTranslations("Home");
  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
        {results.length > 1 ? t("lastResultsTitle") : t("lastResultTitle")}
      </div>
      {results.map((result) => (
        <SingleResultCard key={result.raceId} result={result} locale={locale} />
      ))}
    </div>
  );
}

export async function SingleResultCard({ result, locale }: { result: LastResult; locale: string }) {
  const [t, tFormat, tSex, tCards] = await Promise.all([
    getTranslations("Home"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getTranslations("BonusCards"),
  ]);
  const sex = displayedSex(result);
  const prediction = result.prediction;
  const isWinner = prediction?.playerRank === 1 && prediction.points > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-ice/50 bg-card">
      <div className="flex items-center gap-2 bg-ice px-4 py-2 font-display text-[12px] font-bold uppercase tracking-wide text-on-ice">
        <span className="text-sm">{nationFlagEmoji(result.countryCode)}</span>
        <span className="flex-1 truncate">{result.location}</span>
        <span className="whitespace-nowrap font-semibold normal-case">
          {new Date(result.locksAt).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" })}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex-1 text-sm font-semibold">
          {tFormat(result.format)}
          {sex ? ` ${tSex(sex)}` : ""}
        </div>
        {result.coefficient === 2 && (
          <div className="whitespace-nowrap rounded-full bg-gold-soft px-2 py-0.5 font-display text-[10px] font-bold text-gold">
            {t("coefficientBadge")}
          </div>
        )}
        {prediction && (
          <div className={`font-display text-base font-extrabold ${prediction.points < 0 ? "text-red" : "text-gold"}`}>
            {formatPoints(prediction.points)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <Link
          href={`/courses/${result.raceId}`}
          className="flex items-center justify-center gap-1 font-display text-[13px] font-bold text-ice"
        >
          {t("lastResultSeeRace")}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>

        {prediction ? (
          <>
            {prediction.playerRank && prediction.playerCount > 0 && (
              <div className="text-center font-display text-[14px] font-bold text-gold">
                {isWinner ? `🏆 ${t("lastResultWinner")}` : t("lastResultPlayerRank", { rank: prediction.playerRank, count: prediction.playerCount })}
              </div>
            )}

            {(prediction.multiplier || prediction.card) && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {/* Le ×2 n'est pas compté dans les points de chaque ligne : ce qu'il rapporte est ici. */}
                {prediction.multiplier && (
                  <div className="rounded-full bg-gold-soft px-2.5 py-0.5 font-display text-[11px] font-bold text-gold">
                    {t(`lastResultMultiplier_${prediction.multiplier.kind}`, { points: formatPoints(prediction.multiplier.gain) })}
                  </div>
                )}
                {prediction.card && (
                  <div className="rounded-full bg-ice-soft px-2.5 py-0.5 font-display text-[11px] font-bold text-ice">
                    🃏 {tCards(`name_${prediction.card}`)}
                  </div>
                )}
              </div>
            )}

            <PredictionBreakdown picks={prediction.picks} extras={prediction.extras} showLegend={false} />
          </>
        ) : (
          <div className="text-center text-[13px] text-text-dim">{t("lastResultNoPrediction")}</div>
        )}

        {result.podium.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2.5">
            <div className="font-display text-[11px] font-bold uppercase tracking-wider text-text-dim">{t("lastResultPodium")}</div>
            {result.podium.map((row) => (
              <div key={`${row.rank}-${row.name}`} className="flex items-center gap-2 text-[13px]">
                <span>{MEDALS[row.rank - 1]}</span>
                <span>{nationFlagEmoji(row.nationCode)}</span>
                <span className="truncate font-semibold">{row.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
