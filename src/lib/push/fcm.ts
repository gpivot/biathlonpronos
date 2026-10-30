import { createSign } from "node:crypto";

/**
 * Envoi des notifications par Firebase Cloud Messaging (API HTTP v1), qui livre sur Android et
 * relaie vers Apple pour iOS. Serveur uniquement. Identifiants : le fichier JSON du « compte de
 * service » Firebase (Paramètres du projet > Comptes de service > Générer une clé privée), collé
 * tel quel dans la variable d'environnement FIREBASE_SERVICE_ACCOUNT sur Vercel.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page du site ouverte quand on touche la notification, ex. « /courses/12 ». */
  url?: string;
}

export type SendResult = "sent" | "invalid-token" | "error";

export function readServiceAccount(raw = process.env.FIREBASE_SERVICE_ACCOUNT): ServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

/** Corps de la requête FCM pour un téléphone. */
export function buildFcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: message.url ? { url: message.url } : {},
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    },
  };
}

/**
 * Jeton périmé (appli désinstallée, notifications coupées…) : FCM répond 404 UNREGISTERED, ou
 * 400 INVALID_ARGUMENT quand le jeton est mal formé. On le supprime alors de la base.
 */
export function isInvalidTokenResponse(status: number, body: unknown): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  const error = (body as { error?: { message?: string; details?: { errorCode?: string }[] } } | null)?.error;
  const codes = (error?.details ?? []).map((d) => d.errorCode);
  if (codes.includes("UNREGISTERED")) return true;
  // INVALID_ARGUMENT sert aussi pour un message mal construit : seul le jeton nous intéresse ici.
  return codes.includes("INVALID_ARGUMENT") && /registration token/i.test(error?.message ?? "");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Jeton d'accès Google (valable une heure) obtenu en signant un JWT avec la clé du compte de service. */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const json = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(`Connexion à Firebase refusée : ${json.error_description ?? response.status}`);
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

/** Envoie une notification à un téléphone. */
export async function sendToToken(account: ServiceAccount, token: string, message: PushMessage): Promise<SendResult> {
  const accessToken = await getAccessToken(account);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildFcmMessage(token, message)),
  });
  if (response.ok) return "sent";
  const body = await response.json().catch(() => null);
  return isInvalidTokenResponse(response.status, body) ? "invalid-token" : "error";
}
