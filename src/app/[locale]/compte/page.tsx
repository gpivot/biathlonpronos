import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, HelpIcon, MessageIcon, PencilIcon } from "@/components/icons";
import { LanguagePills } from "./LanguagePills";
import { PseudoEditor } from "./PseudoEditor";
import { AvatarPicker } from "./AvatarPicker";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsCard } from "./NotificationsCard";
import { withDefaults } from "@/lib/notifications/preferences";
import { SignOutButton } from "./SignOutButton";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { FaqList } from "@/components/FaqList";
import { unreadRepliesCount } from "@/lib/supportMessages";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = createClient();
  const t = await getTranslations("Compte");

  const {
    data: { user },
  } = await getAuthUser();

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
  const [{ data: profile }, { data: notificationRow }, { count: phoneCount }, unreadReplies] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", user.id),
    // Messagerie « Suggérer une modification » (migration 0037) : 0 tant que la table n'existe pas.
    unreadRepliesCount(admin, user.id).catch(() => 0),
  ]);

  const tGlobal = await getTranslations("Landing");
  const pseudo = profile?.pseudo ?? "";

  // Page Profil calquée sur VéloPronos.
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-6 pt-6">
        <TitleBar />

        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <AvatarPicker initial={(profile as { avatar?: string | null } | null)?.avatar ?? null} pseudo={pseudo} />
          <PseudoEditor userId={user.id} initialPseudo={pseudo} />
          <div className="text-[13px] text-text-dim">{user.email}</div>
        </div>

        <NotificationsCard initial={withDefaults(notificationRow)} email={user.email ?? ""} phoneCount={phoneCount ?? 0} />

        <Card>
          <ThemeToggle />
        </Card>

        <Card>
          <SectionLabel>🌐 {t("languageTitle")}</SectionLabel>
          <LanguagePills />
          <p className="text-center text-[12px] text-text-dim">{t("languagesAvailable", { count: 5 })}</p>
        </Card>

        <div className="flex flex-col gap-2.5">
          <details id="faq" className="group scroll-mt-6 rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3.5 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <IconBox>
                <span className="font-display text-lg font-extrabold leading-none">?</span>
              </IconBox>
              <span className="flex-1 font-display text-sm font-bold">{t("faqTitle")}</span>
              <ChevronDownIcon className="h-4 w-4 text-text-dim transition group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-3">
              <FaqList rulesLink={false} />
            </div>
          </details>
          <LinkRow href="/regles" icon={<HelpIcon className="h-5 w-5" />} label={t("helpAndRules")} />
          <LinkRow
            href="/compte/messages"
            icon={<PencilIcon className="h-5 w-5" />}
            label={t("suggestChange")}
            hint={t("suggestChangeHint")}
            badge={unreadReplies}
          />
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

function LinkRow({
  href,
  icon,
  label,
  hint,
  badge = 0,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
      <IconBox>{icon}</IconBox>
      <span className="flex flex-1 flex-col">
        <span className="font-display text-sm font-bold">{label}</span>
        {hint && <span className="text-[12px] text-text-dim">{hint}</span>}
      </span>
      {badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 text-text-dim" />
    </Link>
  );
}
