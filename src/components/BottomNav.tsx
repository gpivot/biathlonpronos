import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeIcon, CalendarIcon, PodiumIcon, StarIcon, LeaguesIcon, ShieldIcon } from "./icons";

const items = [
  { href: "/", labelKey: "home", icon: HomeIcon },
  { href: "/courses", labelKey: "stages", icon: CalendarIcon },
  { href: "/classement", labelKey: "standings", icon: PodiumIcon },
  { href: "/pronos", labelKey: "predictions", icon: StarIcon },
  { href: "/ligues", labelKey: "leagues", icon: LeaguesIcon },
] as const;

async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return profile?.is_admin ?? false;
}

export async function BottomNav({ active }: { active: (typeof items)[number]["href"] }) {
  const [t, isAdmin] = await Promise.all([getTranslations("Nav"), isCurrentUserAdmin()]);

  return (
    <nav className="flex items-center justify-around border-t border-border bg-bg/90 px-1 py-3.5 pb-5">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 font-display text-[10px] font-semibold ${
              isActive ? "text-ice" : "text-text-dim"
            }`}
          >
            <Icon className="h-5 w-5" />
            {t(labelKey)}
          </Link>
        );
      })}
      {isAdmin && (
        // /admin est hors i18n (back-office interne) : lien natif, pas <Link> de next-intl.
        <a href="/admin" className="flex flex-col items-center gap-1 font-display text-[10px] font-semibold text-text-dim">
          <ShieldIcon className="h-5 w-5" />
          {t("admin")}
        </a>
      )}
    </nav>
  );
}
