"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";

/** Petit bouton « ? » qui ouvre une explication en pop-up (pictos et leur signification). */
export function HelpButton({
  title,
  items,
  openLabel,
  closeLabel,
}: {
  title: string;
  items: { icon: string; text: string }[];
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card font-display text-xs font-extrabold text-ice"
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-base font-bold normal-case tracking-normal text-frost">{title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-dim"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="flex flex-col gap-2.5 text-[13px] font-normal normal-case leading-relaxed tracking-normal text-frost">
              {items.map((item, index) => (
                <li key={`${index}-${item.icon}`} className="flex gap-2.5">
                  <span className="min-w-5 flex-shrink-0 text-center">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
