"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { ChoicePicker } from "@/components/ChoicePicker";

/**
 * Équipe favorite (nation + sexe) : premier choix possible à tout moment tant que la carte Équipe
 * n'est pas active (`locked`). Modifiable jusqu'au départ de la 1re course de Coupe du Monde
 * (`editable`, migration 0046), puis définitive pour la saison.
 * Sur la page des pronostics de saison (/globes), où se font tous les choix de début de saison.
 */
export function FavoriteTeamForm({
  seasonId,
  nations,
  initial,
  locked,
  editable = false,
  editDeadline = null,
  autoEdit = false,
}: {
  seasonId: string;
  nations: { code: string; name: string }[];
  initial: { nationCode: string; sex: "H" | "F" } | null;
  locked: boolean;
  /** Modifiable jusqu'au départ de la 1re course de Coupe du Monde. */
  editable?: boolean;
  /** Date et heure de ce départ, déjà formatées (null si pas encore au calendrier). */
  editDeadline?: string | null;
  /** Arrivée depuis la ligne « Équipe favorite » du Calendrier : modification ouverte d'office. */
  autoEdit?: boolean;
}) {
  const [nationCode, setNationCode] = useState(initial?.nationCode ?? nations[0]?.code ?? "");
  const [sex, setSex] = useState<"H" | "F">(initial?.sex ?? "F");
  const [chosen, setChosen] = useState(initial);
  const [editing, setEditing] = useState(autoEdit && editable && !!initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Compte");
  const tForm = useTranslations("PredictionForm");
  const nationName = (code: string) => nations.find((n) => n.code === code)?.name ?? code;
  const sexLabel = (s: "H" | "F") => (s === "F" ? t("women") : t("men"));

  async function confirm() {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Modification : la base ne l'accepte que jusqu'au départ de la 1re course de Coupe du Monde.
    const { data: updated, error } = chosen
      ? await supabase
          .from("favorite_teams")
          .update({ nation_code: nationCode, sex })
          .eq("user_id", user.id)
          .eq("season_id", seasonId)
          .select("user_id")
      : await supabase.from("favorite_teams").insert({ user_id: user.id, season_id: seasonId, nation_code: nationCode, sex }).select("user_id");
    setSaving(false);
    if (error || (chosen && (updated ?? []).length === 0)) {
      setError(error && !chosen ? error.message : t("favoriteTeamLockedNow"));
      return;
    }
    setChosen({ nationCode, sex });
    setConfirming(false);
    setEditing(false);
    router.refresh();
  }

  const deadlineHint = editable
    ? editDeadline
      ? t("favoriteTeamEditableUntil", { date: editDeadline })
      : t("favoriteTeamEditableNoDate")
    : null;

  return (
    <div id="equipe-favorite" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("favoriteTeamTitle")}</div>

      {chosen && !editing ? (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">{nationFlagEmoji(chosen.nationCode)}</span>
            {nationName(chosen.nationCode)} {sexLabel(chosen.sex)}
          </div>
          <p className="text-[12px] leading-relaxed text-text-dim">{editable ? deadlineHint : t("favoriteTeamChosen")}</p>
          {editable && (
            <button
              type="button"
              onClick={() => {
                setNationCode(chosen.nationCode);
                setSex(chosen.sex);
                setError(null);
                setEditing(true);
              }}
              className="self-start rounded-xl border border-border px-4 py-2 font-display text-sm font-bold"
            >
              {t("favoriteTeamEdit")}
            </button>
          )}
        </>
      ) : !chosen && locked ? (
        <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamLocked")}</p>
      ) : (
        <>
          <p className="text-[12px] leading-relaxed text-text-dim">{t("favoriteTeamHint")}</p>
          {deadlineHint && <p className="text-[12px] leading-relaxed text-text-dim">{deadlineHint}</p>}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <ChoicePicker
                title={t("favoriteTeamTitle")}
                icon={<span className="text-xl leading-none">❤️</span>}
                options={nations.map((n) => ({ id: n.code, name: n.name, nationCode: n.code }))}
                value={nationCode}
                onChange={(code) => {
                  setNationCode(code);
                  setConfirming(false);
                }}
                searchPlaceholder={tForm("searchNation")}
                defaultOpen={autoEdit}
                onCard
              />
            </div>
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
                ⚠️{" "}
                {t(editable ? "favoriteTeamWarningEditable" : "favoriteTeamWarning", {
                  team: `${nationFlagEmoji(nationCode)} ${nationName(nationCode)} ${sexLabel(sex)}`,
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving}
                  className="rounded-xl bg-gold px-4 py-2 font-display text-sm font-bold text-on-gold disabled:opacity-60"
                >
                  {saving ? t("saving") : t("favoriteTeamConfirm")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    if (chosen) setEditing(false);
                  }}
                  className="rounded-xl border border-border px-4 py-2 font-display text-sm font-bold text-text-dim"
                >
                  {t("favoriteTeamCancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!!chosen && chosen.nationCode === nationCode && chosen.sex === sex}
                className="self-start rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-on-ice disabled:opacity-40"
              >
                {t("favoriteTeamChoose")}
              </button>
              {chosen && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-border px-4 py-2 font-display text-sm font-bold text-text-dim"
                >
                  {t("favoriteTeamCancel")}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
