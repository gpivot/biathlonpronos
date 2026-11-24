"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon, PencilIcon } from "@/components/icons";
import type { ReactNode } from "react";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { SeasonCategoryIcon } from "@/components/SeasonCategoryIcon";

export interface SeasonPick {
  key: string;
  /** Clé de traduction : Globes.category_*. */
  labelKey: string;
  /** null : pas encore choisi. */
  name: string | null;
  nationCode: string | null;
}

/**
 * « Mes pronostics de saison » (les 6 globes ; la Pépite cachée a son propre encadré), replié par défaut en haut du Calendrier.
 * `readOnly` : ceux d'un autre joueur (pop-up du Classement), sans lien de modification.
 */
export function SeasonPredictionsAccordion({
  picks,
  readOnly = false,
  open: picksOpen = false,
  favoriteTeam,
}: {
  picks: SeasonPick[];
  readOnly?: boolean;
  /**
   * Équipe favorite du joueur (sa propre saison seulement) : « France Femmes », ou null si pas encore
   * choisie (bouton « Choisir » vers /globes tant que c'est possible). Absent : pas de ligne.
   */
  favoriteTeam?: { label: string; nationCode: string; editable?: boolean } | { label: null; choosable: boolean };
  /** Encore modifiables : un bouton « Compléter » remplace « Pas encore choisi » sur les lignes vides. */
  open?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Courses");
  const tGlobes = useTranslations("Globes");
  const tCompte = useTranslations("Compte");
  const chosen = picks.filter((p) => p.name).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-soft text-lg">🏆</div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">{readOnly ? t("seasonPredictionsTitleOther") : t("seasonPredictionsTitle")}</div>
          <div className="text-xs text-text-dim">{t("seasonPredictionsCount", { chosen, total: picks.length })}</div>
        </div>
        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-text-dim transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {picks.map((pick) => (
            <PickRow
              key={pick.key}
              // Tant que c'est modifiable, chaque ligne ouvre directement la modification de ce prono.
              href={!readOnly && picksOpen ? `/globes?modifier=${pick.key}` : null}
              showPencil={!!pick.name}
              editLabel={tGlobes("pickerEdit")}
              label={
                <>
                  <SeasonCategoryIcon category={pick.labelKey.slice("category_".length)} className="h-5 w-5 flex-shrink-0" />
                  {tGlobes(pick.labelKey)}
                </>
              }
              value={
                pick.name ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                    {pick.nationCode && <span>{nationFlagEmoji(pick.nationCode)}</span>}
                    <span className="truncate">{pick.name}</span>
                  </div>
                ) : !readOnly && picksOpen ? (
                  <span className="whitespace-nowrap rounded-full bg-gold px-3 py-1 font-display text-[12px] font-bold text-on-gold">
                    {t("seasonPredictionsComplete")}
                  </span>
                ) : (
                  <div className="text-[12px] text-text-dim">{t("seasonPredictionsNone")}</div>
                )
              }
            />
          ))}
          {favoriteTeam && (
            <PickRow
              href={
                favoriteTeam.label !== null
                  ? favoriteTeam.editable
                    ? "/globes?modifier=equipe#equipe-favorite"
                    : null
                  : favoriteTeam.choosable
                    ? "/globes?modifier=equipe#equipe-favorite"
                    : null
              }
              showPencil={favoriteTeam.label !== null}
              editLabel={tGlobes("pickerEdit")}
              label={
                <>
                  <span className="w-5 flex-shrink-0 text-center">❤️</span>
                  {tCompte("favoriteTeamTitle")}
                </>
              }
              value={
                favoriteTeam.label !== null ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                    <span>{nationFlagEmoji(favoriteTeam.nationCode)}</span>
                    <span className="truncate">{favoriteTeam.label}</span>
                  </div>
                ) : favoriteTeam.choosable ? (
                  <span className="whitespace-nowrap rounded-full bg-gold px-3 py-1 font-display text-[12px] font-bold text-on-gold">
                    {t("favoriteTeamChoose")}
                  </span>
                ) : (
                  <div className="text-[12px] text-text-dim">{t("seasonPredictionsNone")}</div>
                )
              }
            />
          )}
          {!readOnly && (
            <Link
              href="/globes"
              className="rounded-full border border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-ice"
            >
              {t("seasonPredictionsLink")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Une ligne de l'encadré : lien vers la modification de ce prono quand `href` est donné, sinon simple affichage. */
function PickRow({
  href,
  label,
  value,
  editLabel,
  showPencil,
}: {
  href: string | null;
  label: ReactNode;
  value: ReactNode;
  editLabel: string;
  /** Crayon à droite (inutile quand la ligne montre déjà « Compléter » / « Choisir »). */
  showPencil: boolean;
}) {
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-text-dim">{label}</div>
      {value}
      {href && showPencil && (
        <>
          <PencilIcon className="-ml-1 h-3.5 w-3.5 flex-shrink-0 text-text-dim transition-colors group-hover:text-ice" />
          <span className="sr-only">{editLabel}</span>
        </>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      title={editLabel}
      className="group flex items-center gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5 transition-colors hover:border-ice active:bg-ice-soft"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5">{content}</div>
  );
}
