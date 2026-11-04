"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cleanSupportMessage } from "@/lib/supportMessages";
import { readServiceAccount } from "@/lib/push/fcm";
import { sendPush } from "@/lib/push/send";

/** Au-delà, on suppose un abus (ou un bouton qui s'emballe) : 20 messages par heure. */
const MAX_PER_HOUR = 20;

/**
 * Le joueur écrit à l'équipe Biathlonpronos (« Suggérer une modification »). La table n'est
 * accessible qu'au serveur (migration 0037) : on vérifie ici que le joueur est connecté. Les
 * admins reçoivent une notification sur leur téléphone (s'il a l'appli), en français.
 */
export async function sendSupportMessage(raw: string): Promise<"ok" | "invalid" | "tooMany" | "error"> {
  const body = cleanSupportMessage(typeof raw === "string" ? raw : "");
  if (!body) return "invalid";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return "error";

  const admin = createAdminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("from_admin", false)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) return "tooMany";

  const { error } = await admin.from("support_messages").insert({ user_id: user.id, from_admin: false, body });
  if (error) return "error";

  if (readServiceAccount()) {
    try {
      const [{ data: admins }, { data: profile }] = await Promise.all([
        admin.from("profiles").select("id").eq("is_admin", true),
        admin.from("profiles").select("pseudo").eq("id", user.id).maybeSingle(),
      ]);
      const adminIds = (admins ?? []).map((a) => a.id).filter((id) => id !== user.id);
      if (adminIds.length > 0) {
        await sendPush(
          {
            title: `✉️ Message de ${profile?.pseudo ?? "un joueur"}`,
            body: body.length > 200 ? `${body.slice(0, 199)}…` : body,
            url: `/admin/messages/${user.id}`,
          },
          { userIds: adminIds }
        );
      }
    } catch {
      // La notification est un plus : le message est enregistré quoi qu'il arrive.
    }
  }

  revalidatePath("/[locale]/compte/messages", "page");
  return "ok";
}
