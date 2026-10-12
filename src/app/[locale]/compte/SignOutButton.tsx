"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutIcon } from "@/components/icons";

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
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red/60 py-3.5 font-display text-sm font-semibold text-red hover:bg-red/10"
    >
      <LogoutIcon className="h-5 w-5" />
      {t("signOut")}
    </button>
  );
}
