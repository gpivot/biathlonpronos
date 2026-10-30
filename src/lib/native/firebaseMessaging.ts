import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { locales } from "../../i18n/routing";

/**
 * Pont vers l'appli Android / iOS (dossier mobile/, Capacitor). L'appli affiche le site en ligne :
 * dans un navigateur ordinaire ces fonctions ne font rien, dans l'appli elles appellent le plugin
 * natif @capacitor-firebase/messaging, installé côté appli seulement (on ne déclare ici que la
 * partie utilisée, pour ne pas embarquer le SDK Firebase web dans le site).
 */

export type PushPermission = "prompt" | "prompt-with-rationale" | "granted" | "denied";

interface FirebaseMessagingPlugin {
  checkPermissions(): Promise<{ receive: PushPermission }>;
  requestPermissions(): Promise<{ receive: PushPermission }>;
  getToken(): Promise<{ token: string }>;
  addListener(
    event: "tokenReceived",
    listener: (event: { token: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "notificationActionPerformed",
    listener: (event: { notification: { data?: unknown } }) => void
  ): Promise<PluginListenerHandle>;
}

export const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>("FirebaseMessaging");

/** Vrai seulement dans l'appli installée (pas dans Safari / Chrome, même sur téléphone). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): "android" | "ios" | null {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : null;
}

/**
 * Page à ouvrir quand on touche une notification (champ `url` de ses données). Seulement un chemin
 * du site, jamais une adresse externe. Sans langue en tête (« /courses/12 »), on ajoute celle du
 * joueur ; avec (« /en/courses/12 »), on la garde.
 */
export function notificationPath(data: unknown, locale: string): string | null {
  if (!data || typeof data !== "object") return null;
  const url = (data as Record<string, unknown>).url;
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null;
  const hasLocale = (locales as readonly string[]).some((l) => url === `/${l}` || url.startsWith(`/${l}/`) || url.startsWith(`/${l}?`));
  if (hasLocale || url.startsWith("/admin")) return url;
  return url === "/" ? `/${locale}` : `/${locale}${url}`;
}
