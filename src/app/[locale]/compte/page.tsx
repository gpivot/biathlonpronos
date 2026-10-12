import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon, ChevronRightIcon, HelpIcon, MessageIcon, MoonIcon } from "@/components/icons";
import { LanguagePills } from "./LanguagePills";
import { PseudoEditor } from "./PseudoEditor";
import { FavoriteTeamForm } from "./FavoriteTeamForm";
import { SignOutButton } from "./SignOutButton";
import { ClaimCardPicker } from "./ClaimCardPicker";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = createClient();
  const t = await getTranslations("Compte");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6">
        <TitleBar />
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: season }, { data: nations }] = await Promise.all([
    supabase.from("profiles").select("pseudo").eq("id", user.id).single(),
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.from("nations").select("code, name").order("name"),
  ]);

  let favoriteTeam: { nation_code: string; sex: "H" | "F" } | null = null;
  let availableCards: { card_type: string }[] = [];
  let unclaimedCount = 0;
  if (season) {
    const [{ data: favorite }, { data: cards }, { data: streak }, { count: claimedCount }] = await Promise.all([
      supabase
        .from("favorite_teams")
        .select("nation_code, sex")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .maybeSingle(),
      supabase
        .from("bonus_cards")
        .select("card_type")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .eq("status", "available"),
      supabase
        .from("streak_counters")
        .select("cards_earned")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .maybeSingle(),
      supabase
        .from("bonus_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("season_id", season.id),
    ]);
    favoriteTeam = favorite ?? null;
    availableCards = cards ?? [];
    unclaimedCount = Math.max(0, (streak?.cards_earned ?? 0) - (claimedCount ?? 0));
  }

  const [tSupport, tGlobal] = await Promise.all([getTranslations("Support"), getTranslations("Landing")]);
  const pseudo = profile?.pseudo ?? "";
  const supportEmail = tSupport("email");

  // Page Profil calquée sur VéloPronos. Les notifications par email et le thème clair n'existent
  // pas encore : leurs interrupteurs sont affichés désactivés avec la mention « Bientôt ».
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-6 pt-6">
        <TitleBar />

        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue to-ice font-display text-3xl font-extrabold text-white">
            {pseudo.charAt(0).toUpperCase() || "?"}
          </div>
          <PseudoEditor userId={user.id} initialPseudo={pseudo} />
          <div className="text-[13px] text-text-dim">{user.email}</div>
        </div>

        <Card>
          <SectionLabel>📧 {t("emailNotificationsTitle")}</SectionLabel>
          <ToggleRow title={t("reminderTitle")} subtitle={t("reminderHint")} soon={t("soon")} />
          <div className="h-px bg-border" />
          <ToggleRow title={t("resultsTitle")} subtitle={t("resultsHint")} soon={t("soon")} />
        </Card>

        <Card>
          <div className="flex items-center gap-3.5">
            <IconBox>
              <MoonIcon className="h-5 w-5" />
            </IconBox>
            <ToggleRow title={t("appearanceTitle")} subtitle={t("darkTheme")} soon={t("soon")} />
          </div>
        </Card>

        {season && (nations ?? []).length > 0 && (
          <FavoriteTeamForm
            seasonId={season.id}
            nations={nations!}
            initialNationCode={favoriteTeam?.nation_code ?? null}
            initialSex={favoriteTeam?.sex ?? null}
          />
        )}

        {season && unclaimedCount > 0 && (
          <ClaimCardPicker
            seasonId={season.id}
            unclaimedCount={unclaimedCount}
            heldAvailableTypes={availableCards.map((c) => c.card_type)}
          />
        )}

        <Card>
          <SectionLabel>🃏 {t("bonusCardsTitle")}</SectionLabel>
          {availableCards.length === 0 ? (
            <p className="text-[12px] text-text-dim">{t("bonusCardsEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableCards.map((c, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gold-soft px-3 py-1 font-display text-[12px] font-bold text-gold"
                >
                  {t(`cardLabel_${c.card_type}`)}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionLabel>🌐 {t("languageTitle")}</SectionLabel>
          <LanguagePills />
          <p className="text-center text-[12px] text-text-dim">{t("languagesAvailable", { count: 5 })}</p>
        </Card>

        <div className="flex flex-col gap-2.5">
          <LinkRow href="/regles" icon={<HelpIcon className="h-5 w-5" />} label={t("helpAndRules")} />
          <LinkRow href="/support" icon={<MessageIcon className="h-5 w-5" />} label={tGlobal("footerSupport")} />
        </div>

        <div className="pt-3">
          <SignOutButton />
        </div>
        <a
          href={`mailto:${supportEmail}?subject=${encodeURIComponent(t("deleteAccount"))}`}
          className="self-center text-[13px] text-text-dim hover:text-frost"
        >
          {t("deleteAccount")}
        </a>
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

// Interrupteur non fonctionnel pour l'instant (fonctionnalité à venir), affiché activé et grisé.
function ToggleRow({ title, subtitle, soon }: { title: string; subtitle: string; soon: string }) {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="font-display text-sm font-bold">{title}</div>
        <div className="text-[12px] text-text-dim">{subtitle}</div>
      </div>
      <span className="rounded-full bg-card2 px-2 py-0.5 text-[10px] font-semibold uppercase text-text-dim">{soon}</span>
      <div aria-disabled className="relative h-6 w-11 flex-shrink-0 rounded-full bg-[oklch(0.80_0.12_200/0.4)] opacity-60">
        <div className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-bg" />
      </div>
    </div>
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
