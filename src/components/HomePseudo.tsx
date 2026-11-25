"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PencilIcon } from "@/components/icons";

const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

// Pseudo du joueur en haut de la carte Saison de l'accueil, modifiable sur place.
// Pseudo d'origine (tiré de l'e-mail, ex. relais Apple « x7k2qp9mzd ») : encart bien visible
// qui invite à se choisir un nom pour le classement. Pseudo déjà choisi : simple crayon discret.
export function HomePseudo({ userId, pseudo, isDefault }: { userId: string; pseudo: string; isDefault: boolean }) {
  const t = useTranslations("Home");
  const router = useRouter();
  const [current, setCurrent] = useState(pseudo);
  const [draft, setDraft] = useState(isDefault ? "" : pseudo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState(!isDefault);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      setError(t("pseudoLengthError", { min: MIN_LENGTH, max: MAX_LENGTH }));
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await createClient().from("profiles").update({ pseudo: value }).eq("id", userId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCurrent(value);
    setChosen(true);
    setEditing(false);
    router.refresh();
  }

  function startEditing() {
    setDraft(chosen ? current : "");
    setError(null);
    setEditing(true);
  }

  const form = (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          maxLength={MAX_LENGTH}
          placeholder={t("pseudoPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 font-display text-[15px] font-bold outline-none focus:border-ice"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ice px-4 py-2 font-display text-[13px] font-bold text-on-ice disabled:opacity-60"
        >
          {saving ? "…" : t("pseudoSave")}
        </button>
      </div>
      {error && <div className="text-xs text-red">{error}</div>}
      <button type="button" onClick={() => setEditing(false)} className="self-start text-[12px] font-semibold text-text-dim">
        {t("pseudoCancel")}
      </button>
    </form>
  );

  if (!chosen) {
    return (
      <div className="flex flex-col gap-2.5 rounded-xl border border-gold/50 bg-gold-soft px-3.5 py-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">🎯</span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-display text-[14px] font-extrabold text-gold">{t("pseudoInviteTitle")}</span>
            <span className="text-[12px] leading-snug text-text-dim">
              {t.rich("pseudoInviteText", {
                pseudo: current || "?",
                b: (chunks) => <span className="font-mono font-semibold text-frost">{chunks}</span>,
              })}
            </span>
          </div>
        </div>
        {editing ? (
          form
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-full bg-gold py-2 font-display text-[13px] font-bold text-on-gold"
          >
            {t("pseudoInviteButton")}
          </button>
        )}
      </div>
    );
  }

  if (editing) return form;

  return (
    <div className="flex items-center gap-2">
      <span className="truncate font-display text-lg font-extrabold text-frost">{current}</span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={t("pseudoEdit")}
        title={t("pseudoEdit")}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim hover:text-frost"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
