import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppleIcon, LogoMark, PlayIcon } from "@/components/icons";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AppCarousel } from "./AppCarousel";

// Page d'accueil visiteur (non connecté), calquée sur celle de VéloPronos : accroche, « Comment ça
// marche ? », avantages, aperçu des écrans de l'app, pied de page. Les joueurs connectés voient le
// dashboard à la place (cf. src/app/[locale]/page.tsx).
export async function Landing() {
  const t = await getTranslations("Landing");

  const steps = [
    { emoji: "⛷️", title: t("step1Title"), body: t("step1Body") },
    { emoji: "🎯", title: t("step2Title"), body: t("step2Body") },
    { emoji: "🏆", title: t("step3Title"), body: t("step3Body") },
  ];

  const perks = [
    { emoji: "🆓", label: t("whyFree") },
    { emoji: "⚡", label: t("whyFast") },
    { emoji: "🎿", label: t("whyBeginners") },
    { emoji: "👥", label: t("whyLeagues") },
    { emoji: "🎁", label: t("whyCards") },
    { emoji: "🌍", label: t("whyGlobes") },
  ];

  const slides = [
    { emoji: "🏠", title: t("slideHomeTitle"), body: t("slideHomeBody") },
    { emoji: "📅", title: t("slideCalendarTitle"), body: t("slideCalendarBody") },
    { emoji: "🏆", title: t("slideStandingsTitle"), body: t("slideStandingsBody") },
    { emoji: "👥", title: t("slideLeaguesTitle"), body: t("slideLeaguesBody") },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.45_0.15_250/0.45),transparent)]"
        />

        <div className="absolute right-4 top-4 z-10">
          <LocaleSwitcher />
        </div>

        <div className="relative flex flex-col items-center gap-3">
          <LogoMark className="h-20 w-20 text-text" />
          <Wordmark className="text-3xl" />
        </div>

        <h1 className="relative mt-10 max-w-5xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="block text-text">{t("heroTitle")}</span>
          <span className="block bg-gradient-to-r from-blue to-ice bg-clip-text text-transparent">{t("heroAccent")}</span>
        </h1>

        <p className="relative mt-5 max-w-md text-base leading-relaxed text-text-dim sm:text-lg">{t("heroSubtitle")}</p>

        <Link
          href="/sign-in"
          className="relative mt-8 rounded-2xl bg-gradient-to-r from-blue to-ice px-8 py-4 font-display text-base font-extrabold text-white shadow-[0_10px_40px_-10px_oklch(0.62_0.19_255/0.7)] transition hover:brightness-110 sm:text-lg"
        >
          {t("heroCta")} →
        </Link>
        <Link href="/sign-in" className="relative mt-4 text-sm font-medium text-text-dim hover:text-frost">
          {t("heroSignIn")}
        </Link>

        <div className="relative mt-8 font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-dim">
          {t("appStoresTitle")}
        </div>
        <div className="relative mt-3 flex flex-wrap justify-center gap-3">
          <StoreBadge icon={<AppleIcon className="h-6 w-6" />} caption={t("appStoreSoon")} store="App Store" />
          <StoreBadge icon={<PlayIcon className="h-6 w-6" />} caption={t("appStoreSoon")} store="Google Play" />
        </div>

        <div aria-hidden className="relative mt-14 flex h-9 w-6 justify-center rounded-full border-2 border-text-dim/60 pt-1.5">
          <div className="h-2 w-1 animate-bounce rounded-full bg-text-dim" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl px-5 py-16">
        <SectionTitle eyebrow={t("howEyebrow")} title={t("howTitle")} />
        <div className="mt-10 flex flex-col gap-5">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4 rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-xl">
                {step.emoji}
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-display text-xs font-semibold uppercase tracking-wider text-text-dim">
                  {t("stepLabel", { n: index + 1 })}
                </div>
                <div className="font-display text-base font-extrabold leading-snug">{step.title}</div>
                <div className="text-sm leading-relaxed text-text-dim">{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl px-5 py-16">
        <SectionTitle eyebrow={t("whyEyebrow")} title={t("whyTitle")} />
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {perks.map((perk) => (
            <div key={perk.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card/70 px-5 py-4">
              <span className="text-2xl">{perk.emoji}</span>
              <span className="font-display text-sm font-bold">{perk.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl px-5 py-16">
        <SectionTitle eyebrow={t("appEyebrow")} title={t("appTitle")} />
        <div className="mt-10">
          <AppCarousel slides={slides} previousLabel={t("previous")} nextLabel={t("next")} />
        </div>
      </section>

      <footer className="mt-auto border-t border-border px-5 py-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark className="h-5 w-5 text-text" />
          <Wordmark className="text-base" />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-text-dim">
          <Link href="/support" className="hover:text-frost">
            {t("footerSupport")}
          </Link>
          <Link href="/confidentialite" className="hover:text-frost">
            {t("footerPrivacy")}
          </Link>
          <Link href="/cgu" className="hover:text-frost">
            {t("footerTerms")}
          </Link>
        </div>
        <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-text-dim/80">{t("footerDisclaimer")}</p>
        <p className="mt-5 text-xs text-text-dim/70">
          © {new Date().getFullYear()} Biathlon<span className="text-blue">Pronos</span>
        </p>
      </footer>
    </div>
  );
}

function Wordmark({ className }: { className: string }) {
  return (
    <div className={`font-display font-extrabold tracking-tight ${className}`}>
      <span className="text-text">Biathlon</span>
      <span className="text-blue">Pronos</span>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-dim">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

// L'application mobile n'existe pas encore : badges « bientôt disponible », non cliquables.
function StoreBadge({ icon, caption, store }: { icon: React.ReactNode; caption: string; store: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-4 py-2 text-left text-text-dim">
      {icon}
      <div className="leading-tight">
        <div className="text-[10px]">{caption}</div>
        <div className="font-display text-sm font-bold">{store}</div>
      </div>
    </div>
  );
}
