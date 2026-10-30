"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FirebaseMessaging, isNativeApp, nativePlatform, type PushPermission } from "@/lib/native/firebaseMessaging";
import { registerPushToken } from "@/lib/push/actions";

// État des notifications sur le téléphone : affiché seulement dans l'appli Android / iOS.
// Si le joueur les a refusées, seul le téléphone peut les réactiver (iOS ne redemande jamais).
export function PushStatusCard() {
  const t = useTranslations("Compte");
  const locale = useLocale();
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    FirebaseMessaging.checkPermissions()
      .then(({ receive }) => setPermission(receive))
      .catch(() => {});
  }, []);

  if (permission === null) return null;

  async function enable() {
    const { receive } = await FirebaseMessaging.requestPermissions();
    setPermission(receive);
    const platform = nativePlatform();
    if (receive === "granted" && platform) {
      const { token } = await FirebaseMessaging.getToken();
      await registerPushToken(token, platform, locale);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("pushTitle")}</div>
      {permission === "granted" ? (
        <p className="text-[13px]">{t("pushOn")}</p>
      ) : permission === "denied" ? (
        <p className="text-[12px] text-text-dim">{t("pushOff")}</p>
      ) : (
        <button
          type="button"
          onClick={() => enable().catch(() => {})}
          className="rounded-xl bg-ice py-3 font-display text-sm font-bold text-on-ice"
        >
          {t("pushEnable")}
        </button>
      )}
    </div>
  );
}
