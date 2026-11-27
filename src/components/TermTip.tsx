"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CloseIcon } from "@/components/icons";

/**
 * Lexique cliquable (27/11/2026) : un mot du jeu souligné en pointillés ; un appui ouvre une
 * courte explication, avec un lien vers le lexique complet de la page Règles.
 */
export function TermTip({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  const t = useTranslations("Glossary");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t("explain", { term: title })}
        className="cursor-help text-left underline decoration-current/40 decoration-dotted underline-offset-[3px]"
      >
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left normal-case tracking-normal"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-base font-bold text-frost">📖 {title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-dim"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[13px] font-normal leading-relaxed text-frost">{text}</p>
            <Link href="/regles#lexique" className="self-start font-display text-[13px] font-bold text-ice">
              {t("seeAll")} →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
