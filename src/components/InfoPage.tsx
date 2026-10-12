import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";

interface Section {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  // Paragraphes affichés après la liste à puces.
  after?: string[];
  note?: string;
  link?: { href: string; label: string };
  // Affiche l'adresse de contact (clé Support.email) en fin de section.
  email?: boolean;
}

// Pages légales du pied de page (Confidentialité, CGU), mises en page comme sur VéloPronos :
// bandeau, puis une carte par section numérotée. Contenu dans le namespace next-intl donné
// (clés title / back / sections, et optionnellement intro / updated).
export async function InfoPage({ namespace, emoji }: { namespace: "Privacy" | "Terms"; emoji?: string }) {
  const [t, tSupport] = await Promise.all([getTranslations(namespace), getTranslations("Support")]);
  const sections = t.raw("sections") as Section[];
  const email = tSupport("email");
  const otherPage =
    namespace === "Privacy" ? { href: "/cgu", label: tSupport("terms") } : { href: "/confidentialite", label: tSupport("privacy") };

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        backLabel={t("back")}
        emoji={emoji}
        title={t("title")}
        subtitle={t.has("updated") ? t("updated") : undefined}
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-6">
        {t.has("intro") && <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>}

        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-extrabold">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-[13px] leading-relaxed text-text-dim">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-text-dim">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-ice">•</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            {section.after?.map((paragraph) => (
              <p key={paragraph} className="text-[13px] leading-relaxed text-text-dim">
                {paragraph}
              </p>
            ))}
            {section.link && (
              <Link href={section.link.href} className="w-fit text-[13px] font-semibold text-blue underline">
                {section.link.label} →
              </Link>
            )}
            {section.note && (
              <div className="rounded-xl bg-card2 px-3 py-2 text-[12px] leading-relaxed text-text-dim">{section.note}</div>
            )}
            {section.email && (
              <a href={`mailto:${email}`} className="w-fit text-[13px] font-semibold text-blue underline">
                {email}
              </a>
            )}
          </section>
        ))}

        <div className="mt-2 flex justify-center gap-2 text-[11px] text-text-dim">
          <Link href="/support" className="underline hover:text-frost">
            Support
          </Link>
          <span>·</span>
          <Link href={otherPage.href} className="underline hover:text-frost">
            {otherPage.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
