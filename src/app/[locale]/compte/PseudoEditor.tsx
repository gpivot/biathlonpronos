"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PencilIcon } from "@/components/icons";

const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

// Pseudo affiché sous l'avatar, modifiable via le crayon (comme sur VéloPronos).
export function PseudoEditor({ userId, initialPseudo }: { userId: string; initialPseudo: string }) {
  const t = useTranslations("Compte");
  const router = useRouter();
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [draft, setDraft] = useState(initialPseudo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setPseudo(value);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <div className="font-display text-xl font-extrabold">{pseudo}</div>
        <button
          type="button"
          onClick={() => {
            setDraft(pseudo);
            setError(null);
            setEditing(true);
          }}
          aria-label={t("editPseudo")}
          className="text-text-dim hover:text-frost"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="mt-2 flex w-full max-w-xs flex-col items-center gap-2">
      <input
        autoFocus
        value={draft}
        maxLength={MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-4 py-2 text-center font-display text-base font-bold outline-none focus:border-ice"
      />
      {error && <div className="text-xs text-red">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ice px-4 py-1.5 font-display text-[13px] font-bold text-[#062024] disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-xl border border-border bg-card px-4 py-1.5 font-display text-[13px] font-bold text-text-dim"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
