"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPreferenceKey } from "@/lib/notifications/preferences";
import { locales } from "@/i18n/routing";

/**
 * Enregistre un interrupteur de la carte Notifications du profil. La table n'est accessible qu'au
 * serveur (migration 0034) : on vérifie ici que le joueur est connecté et n'est pas invité.
 * La langue de l'interface est mémorisée au passage : c'est celle des e-mails qu'il recevra.
 */
export async function setNotificationPreference(key: string, value: boolean, locale: string): Promise<boolean> {
  if (!isPreferenceKey(key) || typeof value !== "boolean") return false;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return false;

  const { error } = await createAdminClient()
    .from("notification_preferences")
    .upsert({ user_id: user.id, [key]: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return false;

  if ((locales as readonly string[]).includes(locale) && user.user_metadata?.locale !== locale) {
    await supabase.auth.updateUser({ data: { locale } }).catch(() => {});
  }
  return true;
}
