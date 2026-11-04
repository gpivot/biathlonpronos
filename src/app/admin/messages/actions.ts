"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanSupportMessage } from "@/lib/supportMessages";
import { readServiceAccount } from "@/lib/push/fcm";
import { sendPush } from "@/lib/push/send";
import { notificationTexts } from "@/lib/notifications/texts";

/**
 * Réponse de l'admin dans la conversation d'un joueur. Le joueur la lit dans l'appli (Profil >
 * Suggérer une modification) et reçoit une notification sur son téléphone, dans sa langue, quel
 * que soit son réglage « Nouvelles du jeu » : c'est la réponse à sa propre demande.
 */
export async function replyToPlayer(userId: string, raw: string): Promise<{ ok: true; pushed: boolean } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const body = cleanSupportMessage(typeof raw === "string" ? raw : "");
    if (!body) return { ok: false, error: "Message vide ou trop long (2000 caractères maximum)." };

    const admin = createAdminClient();
    const { data: player } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!player) return { ok: false, error: "Joueur introuvable." };

    const { error } = await admin.from("support_messages").insert({ user_id: userId, from_admin: true, body });
    if (error) return { ok: false, error: error.message };
    // Répondre vaut lecture de ses messages.
    await admin.from("support_messages").update({ read_at: new Date().toISOString() }).eq("user_id", userId).eq("from_admin", false).is("read_at", null);

    let pushed = false;
    if (readServiceAccount()) {
      try {
        const report = await sendPush(
          ({ locale }) => {
            const { t } = notificationTexts(locale);
            return {
              title: t("supportReplyPushTitle"),
              body: body.length > 200 ? `${body.slice(0, 199)}…` : body,
              url: "/compte/messages",
            };
          },
          { userIds: [userId] }
        );
        pushed = report.sent > 0;
      } catch {
        // Notification facultative : la réponse est enregistrée.
      }
    }

    revalidatePath("/admin/messages");
    revalidatePath(`/admin/messages/${userId}`);
    return { ok: true, pushed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}
