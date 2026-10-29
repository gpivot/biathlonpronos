"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/** Liste repliée (Top 10 + lignes du joueur) qui se déplie en liste complète au clic. */
export function ShowMore({ collapsed, expanded, label }: { collapsed: ReactNode; expanded: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? expanded : collapsed}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1 rounded-full border border-border bg-card py-2.5 font-display text-[13px] font-bold text-ice"
        >
          {label}
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );
}
