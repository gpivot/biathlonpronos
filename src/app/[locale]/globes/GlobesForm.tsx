"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SeasonCategoryIcon } from "@/components/SeasonCategoryIcon";
import { SearchField } from "@/components/SearchField";
import { filterBySearch } from "@/lib/searchFilter";

export interface GlobeOption {
  id: string;
  label: string;
  /** Code pays à 3 lettres, pour le filtre de recherche. */
  nationCode?: string;
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
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("Globes");
  const tForm = useTranslations("PredictionForm");

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
          <div className="flex items-center gap-1.5">
            <SeasonCategoryIcon category={c.category} className="h-6 w-6 flex-shrink-0" />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
              {t(`category_${c.category}`)}
            </span>
            <button
              type="button"
              onClick={() => setOpenInfo((prev) => (prev === c.category ? null : c.category))}
              aria-label={t("infoLabel")}
              aria-expanded={openInfo === c.category}
              title={t("infoLabel")}
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors ${
                openInfo === c.category ? "border-ice bg-ice text-on-ice" : "border-border text-text-dim hover:border-ice hover:text-ice"
              }`}
            >
              i
            </button>
          </div>
          {openInfo === c.category && (
            <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-snug text-text-dim">
              {t(`info_${c.category}`)}
            </p>
          )}
          <SearchField
            value={searches[c.category] ?? ""}
            onChange={(v) => setSearches((prev) => ({ ...prev, [c.category]: v }))}
            placeholder={tForm(c.isNation ? "searchNation" : "searchAthlete")}
            clearLabel={tForm("searchClear")}
          />
          <select
            value={picks[c.category]}
            onChange={(e) => setPicks((prev) => ({ ...prev, [c.category]: e.target.value }))}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          >
            <option value="">{t("noPick")}</option>
            {visibleOptions(c.options, searches[c.category] ?? "", picks[c.category]).map((o) => (
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
        className="rounded-2xl bg-ice py-3.5 text-center font-display text-[15px] font-bold text-on-ice disabled:opacity-40"
      >
        {saving ? t("saving") : t("submit")}
      </button>
    </div>
  );
}

/** Options filtrées par la recherche (nom ou code pays) ; le choix en cours reste toujours dans la liste. */
export function visibleOptions<T extends GlobeOption>(options: T[], search: string, currentPick: string): T[] {
  const matches = new Set(filterBySearch(options, search, (o) => [o.label, o.nationCode], (o) => o.nationCode));
  return options.filter((o) => o.id === currentPick || matches.has(o));
}
