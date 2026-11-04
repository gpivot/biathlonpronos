import { getTranslations } from "next-intl/server";
import { getAdminProfile } from "@/lib/clock";
import { BottomNavBar, type NavHref } from "./BottomNavBar";

export async function BottomNav({ active }: { active?: NavHref }) {
  const [t, { isAdmin }] = await Promise.all([getTranslations("Nav"), getAdminProfile()]);
  const labels = { home: t("home"), stages: t("stages"), standings: t("standings"), leagues: t("leagues"), admin: t("admin") };
  return <BottomNavBar labels={labels} isAdmin={isAdmin} active={active} />;
}
