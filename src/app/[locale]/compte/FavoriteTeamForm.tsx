"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export function FavoriteTeamForm({
  seasonId,
  nations,
  initialNationCode,
  initialSex,
}: {
  seasonId: string;
  nations: { code: string; name: string }[];
  initialNationCode: string | null;
  initialSex: "H" | "F" | null;
}) {
  const [nationCode, setNationCode] = useState(initialNationCode ?? nations[0]?.code ?? "");
  const [sex, setSex] = useState<"H" | "F">(initialSex ?? "F");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const t = useTranslations("Compte");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("favorite_teams")
      .upsert({ user_id: user.id, season_id: seasonId, nation_code: nationCode, sex }, { onConflict: "user_id,season_id" });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
        {t("favoriteTeamTitle")}
      </div>
      <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamHint")}</p>

      <div className="flex gap-2">
        <select
          value={nationCode}
          onChange={(e) => setNationCode(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
        >
          {nations.map((n) => (
            <option key={n.code} value={n.code}>
              {n.name}
            </option>
          ))}
        </select>
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value as "H" | "F")}
          className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="F">{t("women")}</option>
          <option value="H">{t("men")}</option>
        </select>
      </div>

      {error && <div className="text-xs text-red">{error}</div>}
      {saved && !error && <div className="text-xs text-ice">{t("saved")}</div>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-[#062024] disabled:opacity-60"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </form>
  );
}
