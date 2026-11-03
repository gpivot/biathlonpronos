"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FirebaseMessaging, isNativeApp, nativePlatform, type PushPermission } from "@/lib/native/firebaseMessaging";
import { registerPushToken } from "@/lib/push/actions";
import type { NotificationPreferences, PreferenceKey } from "@/lib/notifications/preferences";
import { setNotificationPreference } from "./notificationActions";

interface Row {
  title: string;
  hint: string;
  push: PreferenceKey;
  email: PreferenceKey | null;
}

/**
 * Carte « Notifications » du profil : pour chaque type de message, un interrupteur Appli
 * (téléphone) et un interrupteur E-mail. Sous le tableau, l'état des notifications sur ce
 * téléphone (dans l'appli) ou une invitation à installer l'appli (sur le site), puis l'adresse
 * à laquelle partent les e-mails.
 */
export function NotificationsCard({
  initial,
  email,
  phoneCount,
}: {
  initial: NotificationPreferences;
  email: string;
  phoneCount: number;
}) {
  const t = useTranslations("Compte");
  const locale = useLocale();
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState(false);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    setNative(true);
    FirebaseMessaging.checkPermissions()
      .then(({ receive }) => setPermission(receive))
      .catch(() => {});
  }, []);

  async function enablePush() {
    const { receive } = await FirebaseMessaging.requestPermissions();
    setPermission(receive);
    const platform = nativePlatform();
    if (receive === "granted" && platform) {
      const { token } = await FirebaseMessaging.getToken();
      await registerPushToken(token, platform, locale);
    }
  }

  function toggle(key: PreferenceKey) {
    const value = !prefs[key];
    setPrefs((current) => ({ ...current, [key]: value }));
    setError(false);
    setNotificationPreference(key, value, locale)
      .then((ok) => {
        if (ok) return;
        setPrefs((current) => ({ ...current, [key]: !value }));
        setError(true);
      })
      .catch(() => {
        setPrefs((current) => ({ ...current, [key]: !value }));
        setError(true);
      });
  }

  const rows: Row[] = [
    { title: t("reminderTitle"), hint: t("reminderHint"), push: "reminder_push", email: "reminder_email" },
    { title: t("resultsTitle"), hint: t("resultsHint"), push: "results_push", email: "results_email" },
    { title: t("liveTitle"), hint: t("liveHint"), push: "live_push", email: null },
    { title: t("newsTitle"), hint: t("newsHint"), push: "news_push", email: "news_email" },
  ];
  const appleRelay = /@privaterelay\.appleid\.com$/i.test(email);

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-end gap-2 pb-1">
        <div className="flex-1 font-display text-xs font-bold uppercase tracking-wider text-text-dim">🔔 {t("notificationsTitle")}</div>
        <div className="w-14 text-center text-[11px] font-semibold text-text-dim">{t("columnApp")}</div>
        <div className="w-14 text-center text-[11px] font-semibold text-text-dim">{t("columnEmail")}</div>
      </div>

      {rows.map((row, i) => (
        <div key={row.push} className={`flex items-center gap-2 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="font-display text-sm font-bold">{row.title}</div>
            <div className="text-[12px] text-text-dim">{row.hint}</div>
          </div>
          <div className="flex w-14 justify-center">
            <Switch on={prefs[row.push]} label={`${row.title} · ${t("columnApp")}`} onClick={() => toggle(row.push)} />
          </div>
          <div className="flex w-14 justify-center">
            {row.email ? (
              <Switch on={prefs[row.email]} label={`${row.title} · ${t("columnEmail")}`} onClick={() => toggle(row.email!)} />
            ) : (
              <span className="text-text-dim/50" title={t("notApplicable")} aria-label={t("notApplicable")}>
                —
              </span>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-[12px] text-red">{t("notificationsSaveError")}</p>}

      <div className="mt-2 flex flex-col gap-2">
        {native ? (
          permission === "granted" ? (
            <Info icon={<span className="text-green">●</span>}>{t("pushOn")}</Info>
          ) : permission === "denied" ? (
            <Info icon="📱">{t("pushOff")}</Info>
          ) : permission !== null ? (
            <button
              type="button"
              onClick={() => enablePush().catch(() => {})}
              className="rounded-xl bg-ice py-3 font-display text-sm font-bold text-on-ice"
            >
              {t("pushEnable")}
            </button>
          ) : null
        ) : phoneCount > 0 ? (
          <Info icon="📱">{t("appInstalled", { count: phoneCount })}</Info>
        ) : (
          <Info icon="📱">{t("getApp")}</Info>
        )}
        <Info icon="✉️">
          <span className="break-words">{t("emailTo", { email })}</span>
          {appleRelay && <span className="mt-0.5 block text-[11px] text-text-dim">{t("appleRelay")}</span>}
        </Info>
      </div>
    </div>
  );
}

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? "bg-ice" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${on ? "left-[22px] bg-bg" : "left-0.5 bg-text-dim"}`}
      />
    </button>
  );
}

function Info({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-card2 px-3 py-2.5 text-[12.5px]">
      <span className="leading-5">{icon}</span>
      <div className="flex-1 leading-5">{children}</div>
    </div>
  );
}
