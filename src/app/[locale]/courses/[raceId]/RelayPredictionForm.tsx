"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { CheckIcon } from "@/components/icons";

export type NationWithOdds = {
  nation_code: string;
  name: string;
  value: number;
};

export function RelayPredictionForm({
  raceId,
  nations,
  initialSelection,
  initialBonusX2,
  x2Eligible,
  x2UsesRemaining,
}: {
  raceId: string;
  nations: NationWithOdds[];
  initialSelection: string | null;
  initialBonusX2: boolean;
  x2Eligible: boolean;
  x2UsesRemaining: number;
}) {
  const [selected, setSelected] = useState<string | null>(initialSelection);
  const [bonusX2, setBonusX2] = useState(initialBonusX2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("PredictionForm");

  const canUseX2 = x2Eligible && (initialBonusX2 || x2UsesRemaining > 0);

  async function submit() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t("loginRequired"));
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: user.id,
        race_id: raceId,
        nation_code: selected,
        athlete_ids: null,
        bonus_x2_used: bonusX2,
      },
      { onConflict: "user_id,race_id" }
    );

    setSaving(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
        {t("chooseNation")}
      </div>

      <div className="flex flex-col gap-2">
        {nations.map((n) => {
          const isSelected = selected === n.nation_code;
          return (
            <button
              key={n.nation_code}
              onClick={() => setSelected(n.nation_code)}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                isSelected ? "border-ice bg-ice-soft" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">{n.name}</span>
                <span className="text-[11px] text-text-dim">{n.nation_code}</span>
              </div>
              <div className={`font-display text-sm font-bold ${isSelected ? "text-ice" : "text-text-dim"}`}>
                ×{n.value}
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${
                  isSelected ? "border-ice bg-ice" : "border-border"
                }`}
              >
                {isSelected && <CheckIcon className="h-3 w-3 text-[#062024]" />}
              </div>
            </button>
          );
        })}
      </div>

      {canUseX2 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonusX2} onChange={(e) => setBonusX2(e.target.checked)} />
          {t("bonusX2Label", { count: x2UsesRemaining })}
        </label>
      )}

      {error && <div className="text-xs text-red">{error}</div>}

      <button
        onClick={submit}
        disabled={!selected || saving}
        className="rounded-2xl bg-ice py-3.5 text-center font-display text-[15px] font-bold text-[#062024] disabled:opacity-40"
      >
        {saving ? t("saving") : t("submit")}
      </button>
    </div>
  );
}
