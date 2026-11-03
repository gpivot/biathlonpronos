import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES, type PreferenceKey } from "@/lib/notifications/preferences";
import { readServiceAccount, sendToToken, type PushMessage } from "./fcm";

export interface PushReport {
  devices: number;
  sent: number;
  failed: number;
  /** Jetons périmés supprimés de la base. */
  removed: number;
  /** Joueurs qui ont reçu la notification sur au moins un téléphone. */
  userIds: string[];
}

/** Message identique pour tous, ou construit pour chaque téléphone (langue, points du joueur…). */
export type PushContent = PushMessage | ((target: { userId: string; locale: string }) => PushMessage | null);

export interface SendPushOptions {
  /** Ne viser que ces joueurs (sinon : tous les téléphones enregistrés). */
  userIds?: string[];
  /** Réglage du profil à respecter : les joueurs qui l'ont coupé sont exclus. */
  preference?: PreferenceKey;
}

const BATCH_SIZE = 20;

/**
 * Envoie une notification aux téléphones enregistrés. Serveur uniquement (clé service_role).
 * Sert à la page /admin/notifications, aux questions bonus live, aux rappels et aux résultats.
 */
export async function sendPush(content: PushContent, options: SendPushOptions = {}): Promise<PushReport> {
  const account = readServiceAccount();
  if (!account) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant ou invalide (variables d'environnement Vercel).");

  const admin = createAdminClient();
  const rows: { token: string; user_id: string; locale: string }[] = [];
  const targets = options.userIds;
  const chunks = targets ? chunk(targets, 500) : [null];
  for (const ids of chunks) {
    let query = admin.from("push_tokens").select("token, user_id, locale");
    if (ids) query = query.in("user_id", ids);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }

  const excluded = options.preference ? await usersWithPreferenceOff(admin, options.preference) : new Set<string>();
  const report: PushReport = { devices: 0, sent: 0, failed: 0, removed: 0, userIds: [] };
  const reached = new Set<string>();
  const invalid: string[] = [];

  const jobs = rows
    .filter((row) => !excluded.has(row.user_id))
    .map((row) => {
      const message = typeof content === "function" ? content({ userId: row.user_id, locale: row.locale }) : content;
      return message ? { row, message } : null;
    })
    .filter((job): job is { row: (typeof rows)[number]; message: PushMessage } => job !== null);
  report.devices = jobs.length;

  for (const batch of chunk(jobs, BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map(({ row, message }) => sendToToken(account, row.token, message).catch(() => "error" as const))
    );
    results.forEach((result, j) => {
      if (result === "sent") {
        report.sent++;
        reached.add(batch[j].row.user_id);
      } else report.failed++;
      if (result === "invalid-token") invalid.push(batch[j].row.token);
    });
  }

  if (invalid.length > 0) {
    const { error: deleteError } = await admin.from("push_tokens").delete().in("token", invalid);
    if (!deleteError) report.removed = invalid.length;
  }
  report.userIds = [...reached];
  return report;
}

/** Joueurs qui ont coupé ce type de notification dans leur profil. */
async function usersWithPreferenceOff(admin: ReturnType<typeof createAdminClient>, key: PreferenceKey): Promise<Set<string>> {
  // Réglage activé par défaut : seuls ceux qui l'ont coupé ont une ligne à false. Désactivé par
  // défaut : il faudrait lister ceux qui l'ont activé, ce qu'aucun appel ne demande (garde-fou).
  if (!DEFAULT_PREFERENCES[key]) throw new Error(`Réglage ${key} désactivé par défaut : non géré par sendPush.`);
  const { data, error } = await admin.from("notification_preferences").select("user_id").eq(key, false);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
