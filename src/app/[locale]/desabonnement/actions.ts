"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { unsubscribeByToken } from "@/lib/notifications/unsubscribe";

export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("t") ?? "");
  const kind = String(formData.get("k") ?? "");
  await unsubscribeByToken(createAdminClient(), token, kind);
  const locale = await getLocale();
  redirect({ href: { pathname: "/desabonnement", query: { t: token, k: kind, done: "1" } }, locale });
}
