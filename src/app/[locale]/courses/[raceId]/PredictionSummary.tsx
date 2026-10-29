"use client";

import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { SaveFeedback } from "./SaveFeedback";

export type SummaryPick = { key: string; label: string; nationCode: string };

/**
 * Haut de la page de pronostic : les choix en cours (chacun avec une croix
 * rouge pour le retirer), le bouton « Activer mon bonus ×2 » et le bouton de
 * validation, pour ne pas avoir à descendre en bas de la liste.
 */
export function PredictionSummary({
  picks,
  requiredCount,
  onRemove,
  x2Available,
  bonusX2,
  x2Remaining,
  onToggleX2,
  canSubmit,
  saving,
  onSubmit,
  unsaved,
  success,
  error,
}: {
  picks: SummaryPick[];
  requiredCount: number;
  onRemove: (key: string) => void;
  x2Available: boolean;
  bonusX2: boolean;
  /** Bonus ×2 restants sur la saison, en comptant le choix affiché. */
  x2Remaining: number;
  onToggleX2: () => void;
  canSubmit: boolean;
  saving: boolean;
  onSubmit: () => void;
  /** Le choix affiché diffère du pronostic enregistré. */
  unsaved: boolean;
  success: string | null;
  error: string | null;
}) {
  const t = useTranslations("PredictionForm");
  const emptySlots = Math.max(0, requiredCount - picks.length);

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("myPicksTitle")}</div>
        <div className="font-display text-sm font-bold text-ice">
          {picks.length} / {requiredCount}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {picks.map((pick) => (
          <div
            key={pick.key}
            className="flex items-center gap-1.5 rounded-full border border-ice bg-ice-soft py-1 pl-2.5 pr-1 text-[13px] font-semibold"
          >
            <span>{nationFlagEmoji(pick.nationCode)}</span>
            <span>{pick.label}</span>
            <button
              type="button"
              onClick={() => onRemove(pick.key)}
              aria-label={t("removePick", { name: pick.label })}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-red text-white"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-text-dim"
          >
            {t("emptySlot")}
          </div>
        ))}
      </div>

      {x2Available && (
        <button
          type="button"
          onClick={onToggleX2}
          disabled={!bonusX2 && x2Remaining === 0}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-40 ${
            bonusX2 ? "border-gold bg-gold text-[#2a1900]" : "border-gold/50 bg-gold-soft text-gold"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className="font-display text-lg font-extrabold">×2</span>
            <span className="flex flex-col">
              <span className="font-display text-[13px] font-bold">{bonusX2 ? t("bonusX2Active") : t("bonusX2Activate")}</span>
              <span className="text-[11px] opacity-80">{t("bonusX2Remaining", { count: x2Remaining })}</span>
            </span>
          </span>
          {bonusX2 && <span className="font-display text-[11px] font-bold underline">{t("bonusX2Cancel")}</span>}
        </button>
      )}

      {/* Une fois validé, la confirmation prend la place du bouton ; il revient dès qu'un choix change. */}
      {success && !error ? (
        <SaveFeedback success={success} error={null} />
      ) : (
        <>
          <button
            onClick={onSubmit}
            disabled={!canSubmit || saving}
            className="rounded-2xl bg-ice py-3.5 text-center font-display text-[15px] font-bold text-on-ice disabled:opacity-40"
          >
            {saving ? t("saving") : t("submit")}
          </button>
          {unsaved && !error && <div className="text-center text-[12px] text-text-dim">{t("unsavedHint")}</div>}
          <SaveFeedback success={null} error={error} />
        </>
      )}
    </div>
  );
}
