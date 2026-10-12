import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface Section {
  title: string;
  body: string;
}

// Pages d'information du pied de page (Support, Confidentialité, CGU) : titre, intro, sections en
// cartes. Le contenu vient du namespace next-intl donné (clés title / intro / sections).
export async function InfoPage({
  namespace,
  values,
  children,
}: {
  namespace: "Support" | "Privacy" | "Terms";
  values?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const t = await getTranslations(namespace);
  const sections = t.raw("sections") as Section[];
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => values?.[key] ?? match);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 pb-10 pt-6">
      <Link href="/" className="text-xs text-text-dim underline">
        ← Biathlonpronos
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
            <div className="font-display text-sm font-bold">{section.title}</div>
            <p className="text-[13px] leading-relaxed text-text-dim">{fill(section.body)}</p>
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}
