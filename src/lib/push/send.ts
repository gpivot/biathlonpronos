import { createAdminClient } from "@/lib/supabase/server";
import { readServiceAccount, sendToToken, type PushMessage } from "./fcm";

export interface PushReport {
  devices: number;
  sent: number;
  failed: number;
  /** Jetons périmés supprimés de la base. */
  removed: number;
}

const BATCH_SIZE = 20;

/**
 * Envoie une notification aux téléphones enregistrés : tous, ou ceux des joueurs `userIds`.
 * Serveur uniquement (clé service_role). Sert à la page /admin/notifications et servira aux
 * questions bonus pendant les courses.
 */
export async function sendPush(message: PushMessage, userIds?: string[]): Promise<PushReport> {
  const account = readServiceAccount();
  if (!account) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant ou invalide (variables d'environnement Vercel).");

  const admin = createAdminClient();
  let query = admin.from("push_tokens").select("token");
  if (userIds) query = query.in("user_id", userIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tokens = (data ?? []).map((row) => row.token as string);
  const report: PushReport = { devices: tokens.length, sent: 0, failed: 0, removed: 0 };
  const invalid: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((token) => sendToToken(account, token, message).catch(() => "error" as const))
    );
    results.forEach((result, j) => {
      if (result === "sent") report.sent++;
      else report.failed++;
      if (result === "invalid-token") invalid.push(batch[j]);
    });
  }

  if (invalid.length > 0) {
    const { error: deleteError } = await admin.from("push_tokens").delete().in("token", invalid);
    if (!deleteError) report.removed = invalid.length;
  }
  return report;
}
