"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/routing";

const PLATFORMS = ["android", "ios"] as const;

/**
 * Enregistre le jeton de notification du téléphone pour le joueur connecté (appelé par
 * PushRegistrar dans l'appli). Un même téléphone peut changer de joueur (déconnexion puis
 * connexion d'un autre compte) : le jeton est la clé, il passe au dernier joueur connecté.
 * La table push_tokens n'est lisible et modifiable que par le serveur (migration 0021).
 * Renvoie false si personne n'est connecté : PushRegistrar réessaiera après la connexion.
 */
export async function registerPushToken(token: string, platform: string, locale: string): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return false;
  if (!(PLATFORMS as readonly string[]).includes(platform)) return false;

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return false;

  const { error } = await createAdminClient()
    .from("push_tokens")
    .upsert(
      {
        token,
        user_id: user.id,
        platform,
        locale: (locales as readonly string[]).includes(locale) ? locale : "fr",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );
  if (error) throw new Error(error.message);
  return true;
}

/** À la déconnexion : le téléphone ne reçoit plus les notifications de ce joueur. */
export async function unregisterPushToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user || typeof token !== "string") return;

  await createAdminClient().from("push_tokens").delete().eq("token", token).eq("user_id", user.id);
}
