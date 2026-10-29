import { getTranslations } from "next-intl/server";
import { nationFlagEmoji } from "@/lib/nationFlags";
import type { LastResultExtra, LastResultPick } from "@/lib/lastResult";

const COMBINATION_KINDS: LastResultExtra["kind"][] = ["top3", "top5", "top10", "pronoParfait"];

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
export async function PredictionBreakdown({
  picks,
  extras,
  showLegend = true,
}: {
  picks: LastResultPick[];
  extras: LastResultExtra[];
  /** Légende Fusée/Gâchette sous les choix (masquée sur l'accueil). */
  showLegend?: boolean;
}) {
  const t = await getTranslations("Home");
  const hasFuseeGachette = showLegend && picks.some((p) => p.fusee || p.gachette);
  // Bonus de combinaison mis en avant en bandeau vert au-dessus des choix ; les autres restent en bas.
  const combination = extras.find((e) => COMBINATION_KINDS.includes(e.kind) && e.points > 0);
  const otherExtras = extras.filter((e) => e !== combination);

  return (
    <>
      {combination && (
        <div className="flex items-center gap-2 rounded-xl border border-green/40 bg-green/10 px-3 py-2.5 text-[13px]">
          <span>{combination.kind === "pronoParfait" ? "⭐" : "🏅"}</span>
          <span className="font-display font-bold text-green">
            {combination.kind === "pronoParfait" ? t("lastResultExtra_pronoParfait") : t("comboBonusLabel")}
          </span>
          {combination.kind !== "pronoParfait" && (
            <span className="rounded-full bg-green/15 px-2 py-0.5 font-display text-[11px] font-bold text-green">
              {t(`comboTier_${combination.kind}`)}
            </span>
          )}
          <span className="ml-auto whitespace-nowrap font-display font-bold text-green">{formatPoints(combination.points)}</span>
        </div>
      )}

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
            <div className="flex min-w-0 flex-1 items-center gap-1 truncate font-semibold">
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

      {otherExtras.map((extra) => (
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
