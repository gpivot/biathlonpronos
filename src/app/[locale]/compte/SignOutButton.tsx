"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Compte");

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-xl border border-border bg-card py-3 font-display text-sm font-semibold text-red"
    >
      {t("signOut")}
    </button>
  );
}
