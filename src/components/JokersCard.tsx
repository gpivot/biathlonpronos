import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { displayedSex } from "@/lib/raceLabel";
import type { SeasonJokers } from "@/lib/seasonView";

/**
 * Classement, encadré « Mon classement » : jokers de fin de saison. Avant leur activation par l'admin, un aperçu (« si la
 * saison s'arrêtait aujourd'hui ») ; ensuite, les résultats effacés et leur effet sur le total.
 */
export function JokersCard({ jokers }: { jokers: SeasonJokers }) {
  const t = useTranslations("Courses");
  const tFormat = useTranslations("RaceFormat");
  const tSex = useTranslations("Sex");
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
        <span className="text-lg">🃏</span>
        <span className="flex flex-1 flex-col">
          <span className="font-display text-[13px] font-bold">{t("jokersTitle")}</span>
          <span className="text-[11px] text-text-dim">{jokers.applied ? t("jokersApplied") : t("jokersPreview")}</span>
        </span>
        <span className={`whitespace-nowrap font-display text-sm font-bold ${jokers.delta < 0 ? "text-red" : "text-ice"}`}>
          {t("jokersDelta", { points: signed(jokers.delta) })}
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-border px-4 pb-4 pt-3">
        <p className="text-[12px] leading-relaxed text-text-dim">{t("jokersHelp")}</p>
        {jokers.erased.length === 0 ? (
          <div className="text-[12px] text-text-dim">{t("jokersNone")}</div>
        ) : (
          jokers.erased.map((line) => {
            const sex = displayedSex({ format: line.format, sex: line.sex });
            return (
              <Link
                key={line.raceId}
                href={`/courses/${line.raceId}`}
                className="flex items-center gap-2.5 rounded-xl bg-card2 px-3 py-2 text-[13px]"
              >
                <span>{nationFlagEmoji(line.countryCode)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {tFormat(line.format)}
                    {sex ? ` ${tSex(sex)}` : ""}
                  </span>
                  <span className="truncate text-[11px] text-text-dim">{line.location}</span>
                </span>
                <span className="whitespace-nowrap text-[12px] font-bold text-text-dim">
                  {line.played ? t("jokersPoints", { points: Math.round(line.points * 10) / 10 }) : t("jokersNotPlayed")}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </details>
  );
}
