"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export interface GlobeOption {
  id: string;
  label: string;
}

export interface GlobeCategoryConfig {
  category: string;
  options: GlobeOption[];
  initialPick: string | null;
  isNation: boolean;
}

export function GlobesForm({ seasonId, categories }: { seasonId: string; categories: GlobeCategoryConfig[] }) {
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.category, c.initialPick ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const t = useTranslations("Globes");

  async function submit() {
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

    const rows = categories
      .filter((c) => picks[c.category])
      .map((c) => ({
        user_id: user.id,
        season_id: seasonId,
        category: c.category,
        athlete_id: c.isNation ? null : picks[c.category],
        nation_code: c.isNation ? picks[c.category] : null,
      }));

    const { error } = await supabase
      .from("season_predictions")
      .upsert(rows, { onConflict: "user_id,season_id,category" });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((c) => (
        <div key={c.category} className="flex flex-col gap-1.5">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            {t(`category_${c.category}`)}
          </div>
          <select
            value={picks[c.category]}
            onChange={(e) => setPicks((prev) => ({ ...prev, [c.category]: e.target.value }))}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          >
            <option value="">{t("noPick")}</option>
            {c.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {error && <div className="text-xs text-red">{error}</div>}
      {saved && !error && <div className="text-xs text-ice">{t("saved")}</div>}

      <button
        onClick={submit}
        disabled={saving}
        className="rounded-2xl bg-ice py-3.5 text-center font-display text-[15px] font-bold text-[#062024] disabled:opacity-40"
      >
        {saving ? t("saving") : t("submit")}
      </button>
    </div>
  );
}
