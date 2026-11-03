import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailKind, type EmailKind } from "./preferences";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Réglage coupé par le lien « Se désabonner » de chaque sorte d'e-mail. */
export const EMAIL_PREFERENCE: Record<EmailKind, "reminder_email" | "results_email" | "news_email"> = {
  reminder: "reminder_email",
  results: "results_email",
  news: "news_email",
};

/** Coupe une sorte d'e-mail pour le joueur à qui appartient ce jeton (sans connexion). */
export async function unsubscribeByToken(admin: SupabaseClient, token: string | null, kind: string | null): Promise<boolean> {
  if (!token || !UUID.test(token) || !isEmailKind(kind)) return false;
  const { data, error } = await admin
    .from("notification_preferences")
    .update({ [EMAIL_PREFERENCE[kind]]: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("user_id");
  return !error && (data ?? []).length > 0;
}

/** Le jeton existe-t-il ? (page de désabonnement, avant confirmation) */
export async function isValidUnsubscribeToken(admin: SupabaseClient, token: string | null): Promise<boolean> {
  if (!token || !UUID.test(token)) return false;
  const { data } = await admin.from("notification_preferences").select("user_id").eq("unsubscribe_token", token).maybeSingle();
  return Boolean(data);
}
