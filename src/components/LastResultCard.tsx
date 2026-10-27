import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { displayedSex } from "@/lib/raceLabel";
import type { LastResult } from "@/lib/lastResult";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatPoints(points: number) {
  // Arrondi au dixième : les cotes décimales multipliées donnent des flottants (2.1 × 3 = 6.300000000000001).
  const rounded = Math.round(points * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} pts`;
}

/** Encart « Dernier résultat » de l'accueil, façon VéloPronos. */
export async function LastResultCard({ result, locale }: { result: LastResult; locale: string }) {
  const [t, tFormat, tSex, tAccount] = await Promise.all([
    getTranslations("Home"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getTranslations("Compte"),
  ]);
  const sex = displayedSex(result);
  const prediction = result.prediction;
  const isWinner = prediction?.playerRank === 1 && prediction.points > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("lastResultTitle")}</div>
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

              {(prediction.bonusX2 || prediction.card) && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {prediction.bonusX2 && (
                    <div className="rounded-full bg-gold-soft px-2.5 py-0.5 font-display text-[11px] font-bold text-gold">
                      {t("lastResultBonusX2")}
                    </div>
                  )}
                  {prediction.card && (
                    <div className="rounded-full bg-ice-soft px-2.5 py-0.5 font-display text-[11px] font-bold text-ice">
                      🃏 {tAccount(`cardLabel_${prediction.card}`)}
                    </div>
                  )}
                </div>
              )}

              {prediction.picks.map((pick) => {
                const negative = pick.points != null && pick.points < 0;
                return (
                  <div
                    key={pick.key}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] ${
                      negative ? "border-red/50 bg-red/10" : "border-transparent bg-card2"
                    } ${pick.points == null ? "opacity-60" : ""}`}
                  >
                    <div className="w-7 flex-shrink-0 font-display font-bold text-text-dim">
                      {pick.rank != null ? `${pick.rank}.` : t("lastResultUnranked")}
                    </div>
                    <div className="text-sm">{nationFlagEmoji(pick.nationCode)}</div>
                    <div className="flex-1 truncate font-semibold">
                      {pick.name}
                      {pick.caFarte && <span className="ml-1 text-[11px] text-ice">×3</span>}
                    </div>
                    <div
                      className={`whitespace-nowrap font-display font-bold ${
                        pick.points == null ? "text-[11px] font-semibold text-text-dim" : negative ? "text-red" : pick.points > 0 ? "text-gold" : "text-text-dim"
                      }`}
                    >
                      {pick.points == null ? t("lastResultNotCounted") : formatPoints(pick.points)}
                    </div>
                  </div>
                );
              })}

              {prediction.extras.map((extra) => (
                <div key={extra.kind} className="flex items-center gap-2 px-3 text-[12px] text-text-dim">
                  <div className="flex-1">{t(`lastResultExtra_${extra.kind}`)}</div>
                  <div className={`font-display font-bold ${extra.points < 0 ? "text-red" : "text-gold"}`}>
                    {formatPoints(extra.points)}
                  </div>
                </div>
              ))}
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
    </div>
  );
}
