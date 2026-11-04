"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AVATARS } from "@/lib/avatars";
import { PencilIcon } from "@/components/icons";
import { setAvatar } from "./avatarActions";

/**
 * Grand carré du profil : le picto choisi, sinon l'initiale du pseudo. Un toucher ouvre la grille
 * des pictos ; « Aucun » revient à l'initiale.
 */
export function AvatarPicker({ initial, pseudo }: { initial: string | null; pseudo: string }) {
  const t = useTranslations("Compte");
  const router = useRouter();
  const [avatar, setCurrent] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  async function choose(value: string | null) {
    const previous = avatar;
    setCurrent(value);
    setOpen(false);
    setError(false);
    const ok = await setAvatar(value).catch(() => false);
    if (!ok) {
      setCurrent(previous);
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("avatarChange")}
        aria-expanded={open}
        className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue to-teal font-display text-3xl font-extrabold text-white"
      >
        {avatar ? <span className="text-[44px] leading-none">{avatar}</span> : pseudo.charAt(0).toUpperCase() || "?"}
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-card text-text-dim">
          <PencilIcon className="h-3.5 w-3.5" />
        </span>
      </button>

      {error && <p className="text-[12px] text-red">{t("avatarError")}</p>}

      {open && (
        <div className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("avatarTitle")}</div>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => choose(emoji)}
                aria-pressed={avatar === emoji}
                className={`flex aspect-square items-center justify-center rounded-xl text-2xl ${
                  avatar === emoji ? "bg-ice-soft ring-2 ring-ice" : "bg-card2 hover:bg-border"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose(null)}
            className="self-center rounded-full border border-border px-4 py-1.5 font-display text-[12px] font-bold text-text-dim"
          >
            {t("avatarNone")}
          </button>
        </div>
      )}
    </div>
  );
}
