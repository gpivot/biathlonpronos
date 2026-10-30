import { useTranslations } from "next-intl";
import type { BonusCardView } from "@/lib/bonusCards";

/**
 * Cartes bonus d'un joueur : disponibles (dorées), actives (jouées, course pas encore notée) et
 * utilisées (grisées, pour mémoire). Encadré « Série en cours » et pop-up du Classement.
 */
export function BonusCardsList({ cards, compact = false }: { cards: BonusCardView[]; compact?: boolean }) {
  const t = useTranslations("BonusCards");
  if (cards.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {cards.map((card) => {
        const status =
          card.state === "available"
            ? t("stateAvailable")
            : card.state === "active"
              ? card.windowSize
                ? t("stateActiveWindow", { started: card.windowStarted ?? 0, size: card.windowSize })
                : t("stateActive")
              : t("stateUsed");
        return (
          <div
            key={card.id}
            className={`flex items-center gap-1.5 rounded-full px-2.5 ${compact ? "py-1" : "py-1.5"} ${
              card.state === "used"
                ? "border border-border text-text-dim opacity-60"
                : card.state === "active"
                  ? "border border-gold bg-gold-soft text-gold"
                  : "bg-gold text-[#2a1900]"
            }`}
          >
            <span className="text-[12px]">🃏</span>
            <span className={`font-display font-bold ${compact ? "text-[11px]" : "text-[12px]"} ${card.state === "used" ? "line-through" : ""}`}>
              {t(`name_${card.type}`)}
            </span>
            <span className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold opacity-80`}>· {status}</span>
          </div>
        );
      })}
    </div>
  );
}
