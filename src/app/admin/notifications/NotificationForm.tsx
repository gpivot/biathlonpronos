"use client";

import { useState, useTransition } from "react";
import { sendNotification, type SendNotificationResult } from "./actions";

const inputClass = "rounded-lg border border-border bg-bg px-3 py-2 text-sm";

export function NotificationForm() {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [result, setResult] = useState<SendNotificationResult | null>(null);

  const send = (audience: "me" | "all") => {
    if (audience === "all" && !window.confirm("Envoyer cette notification à tous les joueurs ?")) return;
    setResult(null);
    startTransition(async () => setResult(await sendNotification({ title, body, url, audience })));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Titre
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Texte
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={400} rows={3} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Page ouverte au clic
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/courses" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => send("me")}
          className="rounded-lg border border-ice px-4 py-2 text-sm font-semibold text-ice disabled:opacity-60"
        >
          Moi seulement (test)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => send("all")}
          className="rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-on-ice disabled:opacity-60"
        >
          Tous les joueurs
        </button>
      </div>
      {pending && <p className="text-sm text-text-dim">Envoi…</p>}
      {result?.ok === false && <p className="text-sm text-red">{result.error}</p>}
      {result?.ok && (
        <p className="text-sm text-text-dim">
          {result.report.devices === 0
            ? "Aucun téléphone inscrit pour l'instant."
            : `Envoyée à ${result.report.sent} téléphone(s) sur ${result.report.devices}${
                result.report.removed > 0 ? `, ${result.report.removed} appli(s) désinstallée(s) retirée(s)` : ""
              }.`}
        </p>
      )}
    </div>
  );
}
