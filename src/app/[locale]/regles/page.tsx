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
  "streak",
  "pepite",
  "fuseegachette",
  "jokers",
  "classement",
] as const;

export default async function ReglesPage() {
  const [t, tLanding] = await Promise.all([getTranslations("Regles"), getTranslations("Landing")]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-6">
      <Link href="/" className="text-xs text-text-dim underline">
        ← {t("title")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="font-display text-lg font-bold">{t("title")}</div>
        <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>
      </div>

      {/* Les 4 points de la page d'accueil visiteur, en résumé avant le détail du règlement. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ice/40 bg-ice-soft p-4">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-ice">{t("essentialsTitle")}</div>
        <ol className="flex flex-col gap-2.5">
          {(["f1", "f2", "f3", "f4"] as const).map((key, index) => (
            <li key={key} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue to-teal font-display text-[12px] font-extrabold text-white">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-[13px] font-bold leading-snug">{tLanding(`${key}Title`)}</span>
                <span className="text-[12px] leading-relaxed text-text-dim">{tLanding(`${key}Body`)}</span>
              </span>
            </li>
          ))}
        </ol>
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
