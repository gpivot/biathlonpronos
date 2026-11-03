"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount } from "./accountActions";

/** Suppression du compte depuis le profil, après une confirmation explicite. */
export function DeleteAccountButton() {
  const t = useTranslations("Compte");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setFailed(false);
    const result = await deleteMyAccount().catch(() => ({ ok: false as const, error: "network" }));
    if (!result.ok) {
      setBusy(false);
      setFailed(true);
      return;
    }
    await createClient().auth.signOut().catch(() => {});
    // Rechargement complet : plus aucune trace de la session, sur le site comme dans l'appli.
    window.location.assign(`/${locale}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="self-center text-[13px] text-text-dim hover:text-frost">
        {t("deleteAccount")}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red/60 bg-card p-4">
      <p className="font-display text-sm font-bold text-red">{t("deleteConfirmTitle")}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-text-dim">{t("deleteConfirmBody")}</p>
      {failed && <p className="mt-2 text-[13px] text-red">{t("deleteError")}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="flex-1 rounded-xl border border-border py-2.5 font-display text-[13px] font-semibold text-text hover:bg-card2"
        >
          {t("deleteCancel")}
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="flex-1 rounded-xl bg-red py-2.5 font-display text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          {busy ? t("deleting") : t("deleteConfirmButton")}
        </button>
      </div>
    </div>
  );
}
