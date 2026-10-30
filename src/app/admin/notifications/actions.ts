"use server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { sendPush, type PushReport } from "@/lib/push/send";

export type SendNotificationResult = { ok: true; report: PushReport } | { ok: false; error: string };

/** Envoie une notification depuis le back-office : à l'admin seul (test) ou à tous les joueurs. */
export async function sendNotification(input: {
  title: string;
  body: string;
  url: string;
  audience: "me" | "all";
}): Promise<SendNotificationResult> {
  try {
    const adminId = await requireAdmin();
    const title = input.title.trim();
    const body = input.body.trim();
    const url = input.url.trim();
    if (!title || !body) return { ok: false, error: "Titre et texte obligatoires." };
    if (title.length > 100 || body.length > 400) return { ok: false, error: "Texte trop long." };
    if (url && (!url.startsWith("/") || url.startsWith("//"))) {
      return { ok: false, error: "Le lien doit être une page du site, qui commence par « / »." };
    }
    const report = await sendPush({ title, body, url: url || undefined }, input.audience === "me" ? [adminId] : undefined);
    return { ok: true, report };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}
