"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/**
 * Garde la langue du joueur dans ses métadonnées Supabase Auth (`user_metadata.locale`) : les
 * e-mails de code (connexion, création de compte) l'utilisent pour être envoyés dans sa langue
 * (modèles dans Supabase > Authentication > Emails, `{{ .Data.locale }}`). Ne fait rien pour un
 * visiteur ou un invité, ni si la langue est déjà la bonne.
 */
export function LocaleSync() {
  const locale = useLocale();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user || user.is_anonymous || user.user_metadata?.locale === locale) return;
      supabase.auth.updateUser({ data: { locale } }).catch(() => {});
    });
  }, [locale]);
  return null;
}
