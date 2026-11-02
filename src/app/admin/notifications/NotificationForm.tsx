"use client";

import { useState, useTransition } from "react";
import { sendNotification, type SendNotificationResult } from "./actions";

const inputClass = "rounded-lg border border-border bg-bg px-3 py-2 text-sm";

export function NotificationForm() {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [result, setResult] = useState<SendNotificationResult | null>(null);

  const send = (audience: "me" | "all") => {
    if (audience === "all" && !window.confirm("Envoyer ce message à tous les joueurs ?")) return;
    setResult(null);
    startTransition(async () => setResult(await sendNotification({ title, body, url, audience, channels: { push, email } })));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Titre
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Texte
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} className={inputClass} />
        <span className="text-xs font-normal text-text-dim">
          {body.length} caractère(s) · 400 maximum pour une notification de l&apos;appli, plus long possible par e-mail
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Page ouverte au clic
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/courses" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          📱 Appli
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          ✉️ E-mail (joueurs qui ont accepté les nouvelles du jeu)
        </label>
      </div>
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
        <div className="flex flex-col gap-1 text-sm text-text-dim">
          {result.report && (
            <p>
              {result.report.devices === 0
                ? "Appli : aucun téléphone à notifier."
                : `Appli : envoyée à ${result.report.sent} téléphone(s) sur ${result.report.devices}${
                    result.report.removed > 0 ? `, ${result.report.removed} appli(s) désinstallée(s) retirée(s)` : ""
                  }.`}
            </p>
          )}
          {result.email && (
            <p>
              {result.email.recipients === 0
                ? "E-mail : aucun joueur n'a accepté les nouvelles du jeu par e-mail."
                : `E-mail : ${result.email.sent} envoyé(s) sur ${result.email.recipients}.`}
            </p>
          )}
          {result.notes.map((note) => (
            <p key={note} className="text-gold">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
