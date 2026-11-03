"use server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush, type PushReport } from "@/lib/push/send";
import { readServiceAccount } from "@/lib/push/fcm";
import { isEmailConfigured } from "@/lib/notifications/email";
import { sendNewsEmail } from "@/lib/notifications/jobs";

export type SendNotificationResult =
  | { ok: true; report: PushReport | null; email: { recipients: number; sent: number } | null; notes: string[] }
  | { ok: false; error: string };

/**
 * Envoie une nouvelle du jeu depuis le back-office : à l'admin seul (test) ou à tous les joueurs,
 * sur les téléphones (sauf ceux qui ont coupé « Nouvelles du jeu ») et, si demandé, par e-mail
 * aux joueurs qui l'ont accepté dans leur profil.
 */
export async function sendNotification(input: {
  title: string;
  body: string;
  url: string;
  audience: "me" | "all";
  channels: { push: boolean; email: boolean };
}): Promise<SendNotificationResult> {
  try {
    const adminId = await requireAdmin();
    const title = input.title.trim();
    const body = input.body.trim();
    const url = input.url.trim();
    if (!title || !body) return { ok: false, error: "Titre et texte obligatoires." };
    if (title.length > 100 || body.length > 2000) return { ok: false, error: "Texte trop long." };
    if (url && (!url.startsWith("/") || url.startsWith("//"))) {
      return { ok: false, error: "Le lien doit être une page du site, qui commence par « / »." };
    }
    if (!input.channels.push && !input.channels.email) return { ok: false, error: "Choisis l'appli, l'e-mail ou les deux." };

    const onlyMe = input.audience === "me" ? [adminId] : undefined;
    const notes: string[] = [];
    let report: PushReport | null = null;
    let email: { recipients: number; sent: number } | null = null;

    if (input.channels.push) {
      if (!readServiceAccount()) notes.push("Appli : Firebase n'est pas branché.");
      else if (body.length > 400) notes.push("Appli : texte trop long pour une notification (400 caractères maximum).");
      else report = await sendPush({ title, body, url: url || undefined }, { userIds: onlyMe, preference: "news_push" });
    }
    if (input.channels.email) {
      if (!isEmailConfigured()) notes.push("E-mail : RESEND_API_KEY n'est pas renseignée sur Vercel.");
      else email = await sendNewsEmail(createAdminClient(), { title, body, url }, onlyMe);
    }
    return { ok: true, report, email, notes };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}
