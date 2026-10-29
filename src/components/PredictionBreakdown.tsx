import { getTranslations } from "next-intl/server";
import { nationFlagEmoji } from "@/lib/nationFlags";
import type { LastResultExtra, LastResultPick } from "@/lib/lastResult";

export function formatPoints(points: number) {
  // Arrondi au dixième : les cotes décimales multipliées donnent des flottants (2.1 × 3 = 6.300000000000001).
  const rounded = Math.round(points * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} pts`;
}

/** Pictos Fusée (meilleur temps de ski) et Gâchette (sans-faute au tir). */
export async function FuseeGachetteBadges({ fusee, gachette }: { fusee: boolean; gachette: boolean }) {
  if (!fusee && !gachette) return null;
  const t = await getTranslations("Home");
  return (
    <>
      {fusee && (
        <span title={t("fuseeLabel")} aria-label={t("fuseeLabel")} className="text-[13px]">
          🚀
        </span>
      )}
      {gachette && (
        <span title={t("gachetteLabel")} aria-label={t("gachetteLabel")} className="text-[13px]">
          🎯
        </span>
      )}
    </>
  );
}

/**
 * Détail d'un pronostic noté : chaque choix avec sa place, ses pictos
 * Fusée/Gâchette et ses points (dans l'ordre d'arrivée), puis les bonus et
 * malus de course (Top 3/5/10, Prono parfait…). Accueil et page d'une course.
 */
export async function PredictionBreakdown({ picks, extras }: { picks: LastResultPick[]; extras: LastResultExtra[] }) {
  const t = await getTranslations("Home");
  const hasFuseeGachette = picks.some((p) => p.fusee || p.gachette);

  return (
    <>
      {picks.map((pick) => {
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
            <div className="flex flex-1 items-center gap-1 truncate font-semibold">
              <span className="truncate">{pick.name}</span>
              {pick.caFarte && <span className="text-[11px] text-ice">×3</span>}
              <FuseeGachetteBadges fusee={pick.fusee} gachette={pick.gachette} />
            </div>
            <div
              className={`whitespace-nowrap font-display font-bold ${
                pick.points == null
                  ? "text-[11px] font-semibold text-text-dim"
                  : negative
                    ? "text-red"
                    : pick.points > 0
                      ? "text-gold"
                      : "text-text-dim"
              }`}
            >
              {pick.points == null ? t("lastResultNotCounted") : formatPoints(pick.points)}
            </div>
          </div>
        );
      })}

      {extras.map((extra) => (
        <div key={extra.kind} className="flex items-center gap-2 px-3 text-[12px] text-text-dim">
          <div className="flex-1">{t(`lastResultExtra_${extra.kind}`)}</div>
          <div className={`font-display font-bold ${extra.points < 0 ? "text-red" : "text-gold"}`}>{formatPoints(extra.points)}</div>
        </div>
      ))}

      {hasFuseeGachette && <FuseeGachetteLegend />}
    </>
  );
}

export async function FuseeGachetteLegend() {
  const t = await getTranslations("Home");
  return <div className="px-3 text-[11px] text-text-dim">{t("fuseeGachetteLegend")}</div>;
}
