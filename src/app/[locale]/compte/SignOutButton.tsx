"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutIcon } from "@/components/icons";
import { FirebaseMessaging, isNativeApp } from "@/lib/native/firebaseMessaging";
import { unregisterPushToken } from "@/lib/push/actions";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Compte");
  const locale = useLocale();

  async function handleSignOut() {
    if (isNativeApp()) {
      // Appli : le téléphone cesse de recevoir les notifications de ce joueur, puis on recharge
      // l'appli pour que le prochain joueur connecté y inscrive le téléphone (PushRegistrar).
      try {
        const { token } = await FirebaseMessaging.getToken();
        await unregisterPushToken(token);
      } catch {
        // Notifications pas configurées sur ce téléphone : rien à retirer.
      }
      await supabase.auth.signOut();
      window.location.assign(`/${locale}/sign-in`);
      return;
    }
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red/60 py-3.5 font-display text-sm font-semibold text-red hover:bg-red/10"
    >
      <LogoutIcon className="h-5 w-5" />
      {t("signOut")}
    </button>
  );
}
