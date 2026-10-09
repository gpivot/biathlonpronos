import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RANK_MULTIPLIERS } from "@/lib/scoring";

const SECTIONS = [
  "principe",
  "grillage",
  "cotes",
  "relais",
  "globes",
  "bonusx2",
  "mondiaux",
  "special",
  "teamnation",
  "streak",
  "pepite",
  "fuseegachette",
  "classement",
] as const;

export default async function ReglesPage() {
  const t = await getTranslations("Regles");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-6">
      <Link href="/" className="text-xs text-text-dim underline">
        ← {t("title")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="font-display text-lg font-bold">{t("title")}</div>
        <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-ice">{t("baremeTitle")}</div>
        <p className="text-[12px] leading-relaxed text-text-dim">{t("baremeHint")}</p>
        <div className="grid grid-cols-5 gap-2 pt-1 text-center">
          {Object.entries(RANK_MULTIPLIERS).map(([rank, multiplier]) => (
            <div key={rank} className="rounded-xl bg-ice-soft py-2">
              <div className="text-[10px] text-text-dim">{rank}e</div>
              <div className="font-display text-sm font-bold text-ice">×{multiplier}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <div key={section} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
            <div className="font-display text-sm font-bold">{t(`s_${section}_title`)}</div>
            <p className="text-[13px] leading-relaxed text-text-dim">{t(`s_${section}_body`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
