import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon, ChevronRightIcon, HelpIcon, MessageIcon } from "@/components/icons";
import { LanguagePills } from "./LanguagePills";
import { PseudoEditor } from "./PseudoEditor";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsCard } from "./NotificationsCard";
import { withDefaults } from "@/lib/notifications/preferences";
import { FavoriteTeamForm } from "./FavoriteTeamForm";
import { isEquipeCardActive } from "@/lib/favoriteTeam";
import { SignOutButton } from "./SignOutButton";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { FaqList } from "@/components/FaqList";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = createClient();
  const t = await getTranslations("Compte");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6">
        <TitleBar />
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </div>
    );
  }

  // Réglages de notification et téléphones : tables réservées au serveur (migrations 0021, 0034).
  const admin = createAdminClient();
  const [{ data: profile }, { data: season }, { data: nations }, { data: notificationRow }, { count: phoneCount }] = await Promise.all([
    supabase.from("profiles").select("pseudo").eq("id", user.id).single(),
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.from("nations").select("code, name").order("name"),
    admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  let favoriteTeam: { nation_code: string; sex: "H" | "F" } | null = null;
  let equipeActive = false;
  if (season) {
    const [{ data: favorite }, active] = await Promise.all([
      supabase.from("favorite_teams").select("nation_code, sex").eq("user_id", user.id).eq("season_id", season.id).maybeSingle(),
      isEquipeCardActive(supabase, user.id, season.id),
    ]);
    favoriteTeam = favorite ?? null;
    equipeActive = active;
  }

  const tGlobal = await getTranslations("Landing");
  const pseudo = profile?.pseudo ?? "";

  // Page Profil calquée sur VéloPronos.
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-6 pt-6">
        <TitleBar />

        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue to-teal font-display text-3xl font-extrabold text-white">
            {pseudo.charAt(0).toUpperCase() || "?"}
          </div>
          <PseudoEditor userId={user.id} initialPseudo={pseudo} />
          <div className="text-[13px] text-text-dim">{user.email}</div>
        </div>

        <NotificationsCard initial={withDefaults(notificationRow)} email={user.email ?? ""} phoneCount={phoneCount ?? 0} />

        <Card>
          <ThemeToggle />
        </Card>

        {season && (nations ?? []).length > 0 && (
          <FavoriteTeamForm
            seasonId={season.id}
            nations={nations!}
            initial={favoriteTeam ? { nationCode: favoriteTeam.nation_code, sex: favoriteTeam.sex } : null}
            locked={equipeActive}
          />
        )}

        <Card>
          <SectionLabel>🌐 {t("languageTitle")}</SectionLabel>
          <LanguagePills />
          <p className="text-center text-[12px] text-text-dim">{t("languagesAvailable", { count: 5 })}</p>
        </Card>

        <section id="faq" className="flex scroll-mt-6 flex-col gap-3 pt-2">
          <SectionLabel>❓ {tGlobal("footerFaq")}</SectionLabel>
          <FaqList rulesLink={false} />
        </section>

        <div className="flex flex-col gap-2.5">
          <LinkRow href="/regles" icon={<HelpIcon className="h-5 w-5" />} label={t("helpAndRules")} />
          <LinkRow href="/support" icon={<MessageIcon className="h-5 w-5" />} label={tGlobal("footerSupport")} />
        </div>

        <div className="pt-3">
          <SignOutButton />
        </div>
        <DeleteAccountButton />
      </div>
      <BottomNav />
    </div>
  );
}

async function TitleBar() {
  const t = await getTranslations("Compte");
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Link>
      <div className="font-display text-lg font-bold">{t("title")}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{children}</div>;
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-ice">{children}</div>
  );
}

function LinkRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
      <IconBox>{icon}</IconBox>
      <span className="flex-1 font-display text-sm font-bold">{label}</span>
      <ChevronRightIcon className="h-4 w-4 text-text-dim" />
    </Link>
  );
}
