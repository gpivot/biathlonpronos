import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "./icons";

/** 6 globes + 2 Pépites. */
export const SEASON_PICKS_TOTAL = 8;

/**
 * Haut de l'encadré « Saison » de l'accueil : invitation à faire ses pronostics de saison tant
 * qu'ils sont ouverts pour le joueur (jusqu'à sa 1re course pronostiquée, au plus tard la mass
 * start femmes du Grand-Bornand, migration 0047), avec la règle expliquée et sa date limite.
 * welcome : invité qui vient de créer son compte (0048) : il a joué une course, il lui reste ses
 * pronostics de saison, à saisir avant le prochain départ (closesAt).
 */
export function SeasonPicksInvite({ chosen, closesAt, welcome = false }: { chosen: number; closesAt: string | null; welcome?: boolean }) {
  const t = useTranslations("Home");
  const done = chosen >= SEASON_PICKS_TOTAL;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <div className="flex-1 font-display text-[13px] font-bold text-gold">{t(welcome ? "seasonPicksWelcomeTitle" : "seasonPicksTitle")}</div>
        <div className="font-display text-[13px] font-extrabold tabular-nums text-gold">
          {chosen} / {SEASON_PICKS_TOTAL}
        </div>
      </div>
      <div className="text-[11px] leading-relaxed text-text-dim">
        {done
          ? closesAt
            ? t("seasonPicksDoneUntil", { date: closesAt })
            : t("seasonPicksDone")
          : t(welcome ? "seasonPicksWelcomeHint" : "seasonPicksHint")}
      </div>
      {welcome && !done && closesAt && (
        <div className="text-[11px] font-semibold leading-relaxed text-frost">{t("seasonPicksWelcomeDeadline", { date: closesAt })}</div>
      )}
      {!done && !welcome && (
        <div className="text-[11px] leading-relaxed text-text-dim">
          {t("seasonPicksRule")}
          {closesAt && <span className="font-semibold text-frost"> {t("seasonPicksDeadline", { date: closesAt })}</span>}
        </div>
      )}
      <Link
        href="/globes"
        className={`flex items-center justify-center gap-1 rounded-full py-2.5 font-display text-[13px] font-bold ${
          done ? "border border-gold/50 text-gold" : "bg-gold text-on-gold"
        }`}
      >
        {done ? t("seasonPicksEdit") : t("seasonPicksButton")}
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
