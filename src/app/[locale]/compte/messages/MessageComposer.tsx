"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/supportMessages";
import { sendSupportMessage } from "./actions";

/** Barre d'écriture en bas de la conversation, comme sur VéloPronos. */
export function MessageComposer({ hasMessages }: { hasMessages: boolean }) {
  const t = useTranslations("SupportMessages");
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    const result = await sendSupportMessage(text).catch(() => "error" as const);
    setSending(false);
    if (result === "ok") {
      setText("");
      router.refresh();
    } else {
      setError(t(result === "tooMany" ? "tooMany" : result === "invalid" ? "invalid" : "error"));
    }
  }

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 flex flex-col gap-1.5 border-t border-border bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
    >
      {error && <p className="text-[12px] text-red">{error}</p>}
      <div className="flex items-end gap-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
          rows={1}
          placeholder={t(hasMessages ? "placeholderReply" : "placeholderFirst")}
          aria-label={t(hasMessages ? "placeholderReply" : "placeholderFirst")}
          className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] text-frost placeholder:text-text-dim focus:border-ice focus:outline-none [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label={t("send")}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ice text-on-ice disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
