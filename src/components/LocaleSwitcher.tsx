"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { FLAGS, FlagFR } from "@/components/flags";

// Choix de la langue façon VéloPronos : bouton rond avec le drapeau de la langue courante, qui
// ouvre un menu déroulant « drapeau + nom de la langue ».
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const Current = FLAGS[locale]?.Flag ?? FlagFR;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={FLAGS[locale]?.label ?? locale}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-text-dim"
      >
        <Current className="h-4 w-6 rounded-[3px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 flex min-w-[160px] flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-lg">
          {routing.locales.map((l) => {
            const { Flag, label } = FLAGS[l] ?? { Flag: FlagFR, label: l };
            const isCurrent = l === locale;
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!isCurrent) router.replace(pathname, { locale: l });
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                  isCurrent ? "bg-card2 font-semibold text-frost" : "text-text-dim hover:bg-card2 hover:text-frost"
                }`}
              >
                <Flag className="h-4 w-6 flex-shrink-0 rounded-[3px]" />
                <span className="flex-1">{label}</span>
                {isCurrent && <span className="text-ice">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
