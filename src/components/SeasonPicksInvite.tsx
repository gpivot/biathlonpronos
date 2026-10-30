import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "./icons";

/** 6 globes + 2 Pépites. */
export const SEASON_PICKS_TOTAL = 8;

/**
 * Bas de l'encadré « Saison » de l'accueil, avant la 1re course : invitation à faire ses
 * pronostics de saison, à la place de la « Série en cours » (qui n'a de sens qu'ensuite).
 */
export function SeasonPicksInvite({ chosen }: { chosen: number }) {
  const t = useTranslations("Home");
  const done = chosen >= SEASON_PICKS_TOTAL;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">🏆</span>
        <div className="flex-1 font-display text-[11px] font-bold uppercase tracking-wider text-text-dim">{t("seasonPicksTitle")}</div>
        <div className="font-display text-[13px] font-extrabold tabular-nums text-gold">
          {chosen} / {SEASON_PICKS_TOTAL}
        </div>
      </div>
      <div className="text-[11px] text-text-dim">{done ? t("seasonPicksDone") : t("seasonPicksHint")}</div>
      <Link
        href="/globes"
        className={`flex items-center justify-center gap-1 rounded-full py-2.5 font-display text-[13px] font-bold ${
          done ? "border border-gold/50 bg-gold-soft text-gold" : "bg-gold text-[#2a1900]"
        }`}
      >
        {done ? t("seasonPicksEdit") : t("seasonPicksButton")}
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
