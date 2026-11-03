import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Réglages de notification d'un joueur (table notification_preferences, migration 0034).
 * Un joueur sans ligne a les réglages par défaut ci-dessous (identiques aux « default » SQL).
 */
export const PREFERENCE_KEYS = [
  "reminder_push",
  "reminder_email",
  "results_push",
  "results_email",
  "live_push",
  "news_push",
  "news_email",
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
export type NotificationPreferences = Record<PreferenceKey, boolean>;

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  reminder_push: true,
  reminder_email: true,
  results_push: true,
  results_email: false,
  live_push: true,
  news_push: true,
  news_email: false,
};

/** Types de message proposés dans le lien « Se désabonner » d'un e-mail. */
export const EMAIL_KINDS = ["reminder", "results", "news"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export function isPreferenceKey(value: unknown): value is PreferenceKey {
  return typeof value === "string" && (PREFERENCE_KEYS as readonly string[]).includes(value);
}

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === "string" && (EMAIL_KINDS as readonly string[]).includes(value);
}

/** Complète une ligne (éventuellement absente) avec les valeurs par défaut. */
export function withDefaults(row: Partial<Record<string, unknown>> | null | undefined): NotificationPreferences {
  const prefs = { ...DEFAULT_PREFERENCES };
  for (const key of PREFERENCE_KEYS) {
    if (typeof row?.[key] === "boolean") prefs[key] = row[key] as boolean;
  }
  return prefs;
}

export interface PlayerSettings {
  prefs: NotificationPreferences;
  unsubscribeToken: string | null;
}

/**
 * Réglages de plusieurs joueurs (clé service). Les joueurs sans ligne reçoivent les valeurs par
 * défaut ; leur jeton de désabonnement est créé à la demande par ensureUnsubscribeTokens.
 */
export async function loadPlayerSettings(admin: SupabaseClient, userIds: string[]): Promise<Map<string, PlayerSettings>> {
  const result = new Map<string, PlayerSettings>();
  for (const id of userIds) result.set(id, { prefs: { ...DEFAULT_PREFERENCES }, unsubscribeToken: null });
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error } = await admin
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      result.set(row.user_id, { prefs: withDefaults(row), unsubscribeToken: row.unsubscribe_token });
    }
  }
  return result;
}

/** Crée la ligne (valeurs par défaut) des joueurs qui n'en ont pas, pour obtenir leur jeton de désabonnement. */
export async function ensureUnsubscribeTokens(admin: SupabaseClient, settings: Map<string, PlayerSettings>, userIds: string[]): Promise<void> {
  const missing = userIds.filter((id) => !settings.get(id)?.unsubscribeToken);
  for (let i = 0; i < missing.length; i += 500) {
    const { data, error } = await admin
      .from("notification_preferences")
      .upsert(missing.slice(i, i + 500).map((user_id) => ({ user_id })), { onConflict: "user_id", ignoreDuplicates: false })
      .select("user_id, unsubscribe_token");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const current = settings.get(row.user_id);
      if (current) current.unsubscribeToken = row.unsubscribe_token;
    }
  }
}

export interface PlayerEmail {
  email: string;
  locale: string;
}

/** Adresses e-mail et langue des joueurs (hors invités), via la fonction SQL player_emails (migration 0034). */
export async function loadPlayerEmails(admin: SupabaseClient, userIds?: string[]): Promise<Map<string, PlayerEmail>> {
  const { data, error } = await admin.rpc("player_emails", { user_ids: userIds ?? null });
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((row: { id: string; email: string; locale: string }) => [row.id, { email: row.email, locale: row.locale }])
  );
}
