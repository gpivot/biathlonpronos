import { useTranslations } from "next-intl";
import { STREAK_TARGET } from "@/lib/scoring/constants";
import type { PlayerCards } from "@/lib/bonusCards";
import { BonusCardsList } from "./BonusCardsList";
import { ClaimCardPicker } from "./ClaimCardPicker";

/**
 * « Série en cours » d'un joueur : courses d'affilée avec des points, sur 10 pour une carte bonus.
 * Accueil, Ma saison et pop-up d'un joueur du Classement. Avec `cards` (le joueur connecté) :
 * choix de la carte gagnée au 10/10 et rappel de ses cartes (disponibles, actives, utilisées).
 */
export function StreakCard({
  current,
  compact = false,
  cards,
  seasonId,
  autoOpenClaim = false,
}: {
  current: number;
  compact?: boolean;
  cards?: PlayerCards;
  seasonId?: string;
  autoOpenClaim?: boolean;
}) {
  const t = useTranslations("Classement");
  const remaining = STREAK_TARGET - current;
  const extras = cards && (
    <>
      {seasonId && cards.unclaimed > 0 && (
        <ClaimCardPicker
          seasonId={seasonId}
          unclaimed={cards.unclaimed}
          heldAvailableTypes={cards.cards.filter((c) => c.state === "available").map((c) => c.type)}
          autoOpen={autoOpenClaim}
        />
      )}
      <BonusCardsList cards={cards.cards} compact={compact} />
    </>
  );

  // Version réduite, en bas de l'encadré « Saison » de l'accueil.
  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🔥</span>
          <div className="flex-1 font-display text-[11px] font-bold uppercase tracking-wider text-text-dim">{t("streakCardTitle")}</div>
          <div className="font-display text-[13px] font-extrabold tabular-nums text-ice">
            {current} / {STREAK_TARGET}
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: STREAK_TARGET }, (_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < current ? "bg-ice" : "bg-border"}`} />
          ))}
        </div>
        <div className="text-[11px] text-text-dim">{t("streakCardRemaining", { count: remaining })}</div>
        {extras}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span className="text-xl">🔥</span>
        <div className="flex-1 font-display text-[15px] font-extrabold uppercase tracking-wide">{t("streakCardTitle")}</div>
        <div className="font-display text-xl font-extrabold tabular-nums text-ice">
          {current} / {STREAK_TARGET}
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: STREAK_TARGET }, (_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i < current ? "bg-ice" : "bg-border"}`} />
        ))}
      </div>
      <div className="text-center font-display text-[12px] font-semibold uppercase tracking-wide text-text-dim">
        {t("streakCardRemaining", { count: remaining })}
      </div>
      {extras}
    </div>
  );
}
