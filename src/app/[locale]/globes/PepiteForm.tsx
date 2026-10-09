"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { GlobeOption } from "./GlobesForm";

export function PepiteForm({
  sex,
  seasonId,
  options,
  initialPick,
  alreadyClaimed,
}: {
  sex: "H" | "F";
  seasonId: string;
  options: (GlobeOption & { odds: number })[];
  initialPick: string | null;
  alreadyClaimed: boolean;
}) {
  const [pick, setPick] = useState(initialPick ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const t = useTranslations("Globes");
  const tCompte = useTranslations("Compte");

  async function submit() {
    if (!pick) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("loginRequired"));
      setSaving(false);
      return;
    }

    const oddsAtPick = options.find((o) => o.id === pick)?.odds ?? 0;

    const { error } = await supabase
      .from("pepites")
      .upsert(
        { user_id: user.id, season_id: seasonId, sex, athlete_id: pick, odds_at_pick: oddsAtPick },
        { onConflict: "user_id,season_id,sex" }
      );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
        {t("pepiteTitle")} — {sex === "F" ? tCompte("women") : tCompte("men")}
      </div>
      <p className="text-[12px] leading-relaxed text-text-dim">{t("pepiteHint")}</p>

      {alreadyClaimed ? (
        <p className="text-[13px] text-ice">{t("pepiteClaimed")}</p>
      ) : (
        <>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={!!initialPick}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm disabled:opacity-60"
          >
            <option value="">{t("noPick")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          {error && <div className="text-xs text-red">{error}</div>}
          {saved && !error && <div className="text-xs text-ice">{t("saved")}</div>}

          {!initialPick && (
            <button
              onClick={submit}
              disabled={!pick || saving}
              className="self-start rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-[#062024] disabled:opacity-40"
            >
              {saving ? t("saving") : t("pepiteSubmit")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
