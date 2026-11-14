"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { copyText } from "@/lib/copyText";

export function CopyInviteButton({ leagueName, code }: { leagueName: string; code: string }) {
  const t = useTranslations("Ligues");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleCopy() {
    const message = t("inviteMessage", { name: leagueName, code, url: "https://www.biathlonpronos.fr" });
    setStatus((await copyText(message)) ? "copied" : "error");
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-xl bg-ice px-4 py-2.5 font-display text-sm font-bold text-on-ice transition active:scale-[0.98]"
      >
        {status === "copied" ? t("inviteCopied") : t("copyInviteButton")}
      </button>
      <p className="text-center text-[11px] text-text-dim" aria-live="polite">
        {status === "error" ? t("inviteCopyError") : t("copyInviteHint")}
      </p>
    </div>
  );
}
