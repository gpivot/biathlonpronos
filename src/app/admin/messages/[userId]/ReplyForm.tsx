"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replyToPlayer } from "../actions";

export function ReplyForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setNote(null);
    const result = await replyToPlayer(userId, text).catch(() => ({ ok: false as const, error: "Erreur inconnue." }));
    setSending(false);
    if (result.ok) {
      setText("");
      setNote({ ok: true, text: result.pushed ? "Réponse envoyée, avec une notification sur son téléphone." : "Réponse envoyée (visible dans son appli)." });
      router.refresh();
    } else {
      setNote({ ok: false, text: result.error });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Ta réponse…"
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-frost focus:border-ice focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-on-ice disabled:opacity-40"
        >
          {sending ? "Envoi…" : "Répondre"}
        </button>
        {note && <span className={`text-sm ${note.ok ? "text-green" : "text-red"}`}>{note.text}</span>}
      </div>
    </form>
  );
}
