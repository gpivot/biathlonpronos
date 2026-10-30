"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { FirebaseMessaging, isNativeApp, nativePlatform, notificationPath } from "@/lib/native/firebaseMessaging";
import { registerPushToken } from "@/lib/push/actions";

/**
 * Notifications de l'appli Android / iOS (rien ne se passe dans un navigateur). Au lancement,
 * demande l'autorisation puis envoie le jeton du téléphone au serveur. Tant que personne n'est
 * connecté, le serveur le refuse : on réessaie à chaque changement de page, donc juste après la
 * connexion. Toucher une notification ouvre la page indiquée dans son champ `url`.
 */
export function PushRegistrar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const registered = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const handles = [
      FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
        const path = notificationPath(notification.data, locale);
        if (path) router.push(path);
      }),
      // Firebase renouvelle parfois le jeton : on enregistre le nouveau.
      FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
        const platform = nativePlatform();
        if (platform) registerPushToken(token, platform, locale).catch(() => {});
      }),
    ];
    // Plugin absent (appli d'une ancienne version) : pas de notifications, le site marche quand même.
    handles.forEach((h) => h.catch(() => {}));
    return () => {
      handles.forEach((h) => h.then((handle) => handle.remove()).catch(() => {}));
    };
  }, [locale, router]);

  useEffect(() => {
    const platform = nativePlatform();
    if (!isNativeApp() || !platform || registered.current || busy.current) return;
    busy.current = true;
    (async () => {
      let { receive } = await FirebaseMessaging.checkPermissions();
      if (receive === "prompt" || receive === "prompt-with-rationale") {
        ({ receive } = await FirebaseMessaging.requestPermissions());
      }
      if (receive !== "granted") {
        registered.current = true; // refusé : on ne redemande pas à chaque page
        return;
      }
      const { token } = await FirebaseMessaging.getToken();
      registered.current = await registerPushToken(token, platform, locale);
    })()
      .catch(() => {
        // Firebase injoignable ou pas configuré : pas de notifications, le site marche quand même.
      })
      .finally(() => {
        busy.current = false;
      });
  }, [pathname, locale]);

  return null;
}
