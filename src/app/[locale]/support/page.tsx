import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";

// Page Support calquée sur celle de VéloPronos : bandeau, puis cartes contact / délai / types de
// demandes / aide. L'adresse email (clé Support.email) est provisoire, à confirmer par Guillaume.
export default async function SupportPage() {
  const t = await getTranslations("Support");
  const email = t("email");
  const types = t.raw("types") as { emoji: string; label: string }[];

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader backLabel={t("back")} emoji="🎯" title={t("title")} subtitle={t("subtitle")} />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-6">
        <Card emoji="📧" title={t("contactTitle")}>
          <p>{t("contactBody")}</p>
          <a
            href={`mailto:${email}`}
            className="mt-3 inline-block rounded-xl bg-gradient-to-r from-blue to-ice px-4 py-2 font-display text-[13px] font-bold text-[#062024] hover:brightness-110"
          >
            {email}
          </a>
        </Card>

        <Card emoji="⏰" title={t("delayTitle")}>
          <p>{t("delayBody")}</p>
        </Card>

        <Card emoji="💬" title={t("typesTitle")}>
          <ul className="flex flex-col gap-1.5">
            {types.map((type) => (
              <li key={type.label}>
                <span className="mr-2">{type.emoji}</span>
                {type.label}
              </li>
            ))}
          </ul>
        </Card>

        <Card emoji="📖" title={t("helpTitle")}>
          <p>{t("helpBody")}</p>
          <Link
            href="/regles"
            className="mt-3 inline-block rounded-xl bg-border px-4 py-2 font-display text-[13px] font-bold text-frost hover:bg-card2"
          >
            {t("helpButton")} →
          </Link>
        </Card>

        <div className="mt-2 flex justify-center gap-2 text-[11px] text-text-dim">
          <Link href="/confidentialite" className="underline hover:text-frost">
            {t("privacy")}
          </Link>
          <span>·</span>
          <Link href="/cgu" className="underline hover:text-frost">
            {t("terms")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-2 font-display text-base font-extrabold">
        <span className="mr-2">{emoji}</span>
        {title}
      </h2>
      <div className="text-[13px] leading-relaxed text-text-dim">{children}</div>
    </section>
  );
}
