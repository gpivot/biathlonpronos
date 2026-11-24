"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { filterBySearch } from "@/lib/searchFilter";
import { SearchField } from "@/components/SearchField";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "@/components/icons";

export interface PickerOption {
  id: string;
  /** Nom affiché (« Lou Jeanmonnot », « France »). */
  name: string;
  /** Code pays à 3 lettres : drapeau à gauche du nom et filtre de recherche. */
  nationCode?: string;
  /** Cote, affichée à droite (absente pour l'équipe favorite). */
  odds?: number;
}

/**
 * Choix d'un biathlète ou d'une nation (pronostics de saison, Pépite cachée, équipe favorite) :
 * remplace le menu déroulant natif (24/11/2026). Le champ montre le choix en cours (drapeau, nom,
 * cote) ; un appui ouvre une fenêtre avec la recherche (nom ou code pays) et la liste, drapeau à
 * gauche. Choisir une ligne appelle `onChange` et ferme la fenêtre.
 * `defaultOpen` : ouverte d'office (arrivée depuis une ligne de « Mes pronostics de saison »).
 */
export function ChoicePicker({
  title,
  options,
  value,
  onChange,
  searchPlaceholder,
  disabled = false,
  defaultOpen = false,
  icon,
  onCard = false,
}: {
  title: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  searchPlaceholder: string;
  disabled?: boolean;
  defaultOpen?: boolean;
  /** Pictogramme à gauche du titre de la fenêtre. */
  icon?: ReactNode;
  /** Champ posé dans un encadré (fond carte) : fond de page pour ressortir. */
  onCard?: boolean;
}) {
  const t = useTranslations("Globes");
  const tForm = useTranslations("PredictionForm");
  const [open, setOpen] = useState(defaultOpen && !disabled);
  const [search, setSearch] = useState("");
  const fieldRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (defaultOpen) fieldRef.current?.scrollIntoView({ block: "center" });
  }, [defaultOpen]);

  // Fenêtre ouverte : la page derrière ne défile plus, Échap la ferme.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = filterBySearch(options, search, (o) => [o.name, o.nationCode], (o) => o.nationCode);

  function close() {
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        ref={fieldRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        className={`flex w-full items-center gap-2.5 rounded-xl border border-border ${onCard ? "bg-bg" : "bg-card"} px-3.5 py-2.5 text-left text-sm transition-colors enabled:hover:border-ice disabled:opacity-60`}
      >
        {current ? (
          <>
            <span className="text-base leading-none">{nationFlagEmoji(current.nationCode)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{current.name}</span>
            {current.odds != null && <span className="font-display text-sm font-bold text-ice">×{current.odds}</span>}
          </>
        ) : (
          <span className="flex-1 text-text-dim">{t("noPick")}</span>
        )}
        {!disabled && <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-text-dim" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={close}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85dvh] w-full max-w-md flex-col gap-3 rounded-t-2xl border border-border bg-bg p-4 sm:h-[80dvh] sm:rounded-2xl"
          >
            <div className="flex items-center gap-2">
              {icon}
              <div className="flex-1 font-display text-base font-bold">{title}</div>
              <button
                type="button"
                onClick={close}
                aria-label={t("pickerClose")}
                title={t("pickerClose")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-dim hover:text-frost"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <SearchField value={search} onChange={setSearch} placeholder={searchPlaceholder} clearLabel={tForm("searchClear")} />

            <div className="-mx-1 flex flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1 pb-2">
              {visible.length === 0 && (
                <div className="rounded-xl border border-border bg-card px-3.5 py-3 text-center text-[13px] text-text-dim">
                  {tForm("searchNoResult")}
                </div>
              )}
              {visible.map((o) => {
                const selected = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      close();
                      if (!selected) onChange(o.id);
                    }}
                    aria-pressed={selected}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      selected ? "border-ice bg-ice-soft" : "border-border bg-card hover:border-ice"
                    }`}
                  >
                    <span className="w-6 flex-shrink-0 text-center text-xl leading-none">{nationFlagEmoji(o.nationCode)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{o.name}</span>
                      {o.nationCode && <span className="text-[11px] text-text-dim">{o.nationCode}</span>}
                    </span>
                    {o.odds != null && (
                      <span className={`font-display text-sm font-bold ${selected ? "text-ice" : "text-text-dim"}`}>×{o.odds}</span>
                    )}
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        selected ? "border-ice bg-ice" : "border-border"
                      }`}
                    >
                      {selected && <CheckIcon className="h-3 w-3 text-on-ice" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
