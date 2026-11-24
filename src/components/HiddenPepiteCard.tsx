import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { PencilIcon } from "@/components/icons";
import type { HiddenPepite } from "@/lib/seasonView";

/**
 * Encadré permanent « Pépite cachée » de Ma saison (entre les pronostics de saison et la série
 * en cours) : la Pépite Femmes et la Pépite Hommes du joueur, révélée ou pas encore.
 * Elle reste invisible des autres joueurs tant qu'elle n'est pas révélée (migration 0018).
 */
export function HiddenPepiteCard({
  pepites,
  editable = false,
}: {
  pepites: HiddenPepite[];
  /** Pronostics de saison ouverts pour ce joueur (0047) : chaque ligne ouvre le choix ou la modification de cette Pépite. */
  editable?: boolean;
}) {
  const t = useTranslations("Courses");
  const tGlobes = useTranslations("Globes");
  const tCompte = useTranslations("Compte");

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-lg">❄️</div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">{t("pepiteCardTitle")}</div>
          <div className="text-xs leading-snug text-text-dim">{t("pepiteCardHint")}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {pepites.map((p) => {
          const rowClass = "flex items-center gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5";
          const sexLabel = <div className="w-16 flex-shrink-0 text-[13px] text-text-dim">{p.sex === "F" ? tCompte("women") : tCompte("men")}</div>;
          const pepiteName = p.name ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold">
              {p.nationCode && <span>{nationFlagEmoji(p.nationCode)}</span>}
              <span className="truncate">{p.name}</span>
            </div>
          ) : null;

          // Pas encore révélée et encore modifiable (ni carte Talent) : toute la ligne ouvre la modification.
          if (p.name && !p.revealed && !p.fromTalent && editable) {
            return (
              <Link
                key={p.sex}
                href={`/globes?modifier=pepite_${p.sex}`}
                title={tGlobes("pickerEdit")}
                className={`group ${rowClass} transition-colors hover:border-ice active:bg-ice-soft`}
              >
                {sexLabel}
                {pepiteName}
                {/* Pas de pastille « Pas encore révélée » ici : la place va au nom, et le crayon signale la modification. */}
                <PencilIcon className="h-3.5 w-3.5 flex-shrink-0 text-text-dim transition-colors group-hover:text-ice" />
                <span className="sr-only">{tGlobes("pickerEdit")}</span>
              </Link>
            );
          }

          return (
            <div key={p.sex} className={rowClass}>
              {sexLabel}
              {p.name ? (
                <>
                  {pepiteName}
                  {p.revealed && p.revealedRaceId ? (
                    // Révélée : renvoie au résultat de la course où elle a été révélée.
                    <Link
                      href={`/courses/${p.revealedRaceId}`}
                      title={t("pepiteSeeRace")}
                      aria-label={`${t("pepiteRevealed")} : ${t("pepiteSeeRace")}`}
                      className="whitespace-nowrap rounded-full bg-ice px-2.5 py-1 font-display text-[11px] font-bold text-on-ice"
                    >
                      {t("pepiteRevealed")} ›
                    </Link>
                  ) : (
                    <div
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${
                        p.revealed ? "bg-ice text-on-ice" : "border border-border text-text-dim"
                      }`}
                    >
                      {p.revealed ? t("pepiteRevealed") : t("pepiteNotRevealed")}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex-1 text-[12px] text-text-dim">{t("pepiteNone")}</div>
                  {editable && (
                  <Link
                    href={`/globes?modifier=pepite_${p.sex}`}
                    className="whitespace-nowrap rounded-full bg-ice px-3 py-1 font-display text-[12px] font-bold text-on-ice"
                  >
                    {t("pepiteChoose")}
                  </Link>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
