import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Messagerie « Suggérer une modification » (migration 0037) : une conversation par joueur avec
 * l'équipe Biathlonpronos. Table réservée au serveur : toujours lue avec la clé service, après
 * avoir vérifié qui est connecté.
 */
export interface SupportMessage {
  id: string;
  user_id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
  read_at: string | null;
}

export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

/** Texte nettoyé, ou null s'il est vide ou trop long. */
export function cleanSupportMessage(raw: string): string | null {
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (!body || body.length > SUPPORT_MESSAGE_MAX_LENGTH) return null;
  return body;
}

/** Réponses de l'admin pas encore lues par le joueur (pastille du profil). */
export async function unreadRepliesCount(admin: SupabaseClient, userId: string): Promise<number> {
  const { count } = await admin
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("from_admin", true)
    .is("read_at", null);
  return count ?? 0;
}

/** Tous les messages de la conversation d'un joueur, du plus ancien au plus récent. */
export async function conversation(admin: SupabaseClient, userId: string): Promise<SupportMessage[]> {
  const { data } = await admin
    .from("support_messages")
    .select("id, user_id, from_admin, body, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as SupportMessage[];
}

/** Marque comme lus les messages reçus par l'un ou l'autre côté de la conversation. */
export async function markRead(admin: SupabaseClient, userId: string, side: "player" | "admin"): Promise<void> {
  await admin
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("from_admin", side === "player")
    .is("read_at", null);
}
