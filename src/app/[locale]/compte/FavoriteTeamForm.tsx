"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { nationFlagEmoji } from "@/lib/nationFlags";

/**
 * Équipe favorite (nation + sexe) : choix définitif pour la saison, possible à tout moment tant que
 * la carte Équipe n'est pas active (`locked`). Une fois choisie, elle n'est plus modifiable.
 */
export function FavoriteTeamForm({
  seasonId,
  nations,
  initial,
  locked,
}: {
  seasonId: string;
  nations: { code: string; name: string }[];
  initial: { nationCode: string; sex: "H" | "F" } | null;
  locked: boolean;
}) {
  const [nationCode, setNationCode] = useState(nations[0]?.code ?? "");
  const [sex, setSex] = useState<"H" | "F">("F");
  const [chosen, setChosen] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Compte");
  const nationName = (code: string) => nations.find((n) => n.code === code)?.name ?? code;
  const sexLabel = (s: "H" | "F") => (s === "F" ? t("women") : t("men"));

  async function confirm() {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("favorite_teams").insert({ user_id: user.id, season_id: seasonId, nation_code: nationCode, sex });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setChosen({ nationCode, sex });
    setConfirming(false);
    router.refresh();
  }

  return (
    <div id="equipe-favorite" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("favoriteTeamTitle")}</div>

      {chosen ? (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">{nationFlagEmoji(chosen.nationCode)}</span>
            {nationName(chosen.nationCode)} {sexLabel(chosen.sex)}
          </div>
          <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamChosen")}</p>
        </>
      ) : locked ? (
        <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamLocked")}</p>
      ) : (
        <>
          <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamHint")}</p>
          <div className="flex gap-2">
            <select
              value={nationCode}
              onChange={(e) => {
                setNationCode(e.target.value);
                setConfirming(false);
              }}
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
              onChange={(e) => {
                setSex(e.target.value as "H" | "F");
                setConfirming(false);
              }}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="F">{t("women")}</option>
              <option value="H">{t("men")}</option>
            </select>
          </div>

          {error && <div className="text-xs text-red">{error}</div>}

          {confirming ? (
            <div className="flex flex-col gap-2.5 rounded-xl border border-gold/50 bg-gold-soft p-3">
              <div className="text-[13px] font-semibold text-gold">
                ⚠️ {t("favoriteTeamWarning", { team: `${nationFlagEmoji(nationCode)} ${nationName(nationCode)} ${sexLabel(sex)}` })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving}
                  className="rounded-xl bg-gold px-4 py-2 font-display text-sm font-bold text-[#2a1900] disabled:opacity-60"
                >
                  {saving ? t("saving") : t("favoriteTeamConfirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-xl border border-border px-4 py-2 font-display text-sm font-bold text-text-dim"
                >
                  {t("favoriteTeamCancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="self-start rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-on-ice"
            >
              {t("favoriteTeamChoose")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
