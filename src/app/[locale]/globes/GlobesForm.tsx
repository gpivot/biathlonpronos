"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SeasonCategoryIcon } from "@/components/SeasonCategoryIcon";
import { ChoicePicker, type PickerOption } from "@/components/ChoicePicker";

export type GlobeOption = PickerOption;

export interface GlobeCategoryConfig {
  category: string;
  options: GlobeOption[];
  initialPick: string | null;
  isNation: boolean;
}

/**
 * Les 6 pronostics de saison. Chaque choix s'enregistre dès qu'il est fait dans la liste
 * (24/11/2026 : plus de bouton « Valider » global). `editCategory` : catégorie dont la liste
 * s'ouvre d'office (arrivée depuis une ligne de « Mes pronostics de saison »).
 */
export function GlobesForm({
  seasonId,
  categories,
  editCategory = null,
}: {
  seasonId: string;
  categories: GlobeCategoryConfig[];
  editCategory?: string | null;
}) {
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.category, c.initialPick ?? ""]))
  );
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | { error: string }>>({});
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const t = useTranslations("Globes");
  const tForm = useTranslations("PredictionForm");

  async function choose(c: GlobeCategoryConfig, id: string) {
    const previous = picks[c.category];
    setPicks((prev) => ({ ...prev, [c.category]: id }));
    setStatus((prev) => ({ ...prev, [c.category]: "saving" }));

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = user
      ? await supabase.from("season_predictions").upsert(
          {
            user_id: user.id,
            season_id: seasonId,
            category: c.category,
            athlete_id: c.isNation ? null : id,
            nation_code: c.isNation ? id : null,
          },
          { onConflict: "user_id,season_id,category" }
        )
      : { error: { message: t("loginRequired") } };

    if (error) {
      setPicks((prev) => ({ ...prev, [c.category]: previous }));
      setStatus((prev) => ({ ...prev, [c.category]: { error: error.message } }));
      return;
    }
    setStatus((prev) => ({ ...prev, [c.category]: "saved" }));
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((c) => {
        const s = status[c.category];
        return (
          <div key={c.category} id={`prono-${c.category}`} className="flex scroll-mt-4 flex-col gap-1.5">
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
            <ChoicePicker
              title={t(`category_${c.category}`)}
              icon={<SeasonCategoryIcon category={c.category} className="h-6 w-6 flex-shrink-0" />}
              options={c.options}
              value={picks[c.category]}
              onChange={(id) => choose(c, id)}
              searchPlaceholder={tForm(c.isNation ? "searchNation" : "searchAthlete")}
              disabled={s === "saving"}
              defaultOpen={editCategory === c.category}
            />
            {s === "saving" && <div className="text-xs text-text-dim">{t("saving")}</div>}
            {s === "saved" && <div className="text-xs text-ice">✓ {t("pickSaved")}</div>}
            {typeof s === "object" && <div className="text-xs text-red">{s.error}</div>}
          </div>
        );
      })}
    </div>
  );
}
