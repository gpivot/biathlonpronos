import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";

interface Section {
  title: string;
  body: string;
}

// Pages légales du pied de page (Confidentialité, CGU) : bandeau, intro, sections en cartes.
// Le contenu vient du namespace next-intl donné (clés title / intro / back / sections).
export async function InfoPage({ namespace }: { namespace: "Privacy" | "Terms" }) {
  const t = await getTranslations(namespace);
  const sections = t.raw("sections") as Section[];

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader backLabel={t("back")} title={t("title")} />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-6">
        <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-bold">{section.title}</h2>
            <p className="text-[13px] leading-relaxed text-text-dim">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
