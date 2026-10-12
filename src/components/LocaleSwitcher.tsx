"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Drapeaux en SVG (et non en emoji) : Windows n'affiche pas les emojis drapeaux.
function FlagFR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  );
}

function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} preserveAspectRatio="xMidYMid slice">
      <clipPath id="gb-clip">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath="url(#gb-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const FLAGS: Record<string, { Flag: (props: { className?: string }) => JSX.Element; label: string }> = {
  fr: { Flag: FlagFR, label: "Français" },
  en: { Flag: FlagGB, label: "English" },
};

// Choix de la langue façon VéloPronos : bouton rond avec le drapeau de la langue courante, qui
// ouvre la liste des autres drapeaux.
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
        <div className="absolute right-0 top-11 z-50 flex flex-col gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-lg">
          {routing.locales
            .filter((l) => l !== locale)
            .map((l) => {
              const { Flag, label } = FLAGS[l] ?? { Flag: FlagFR, label: l };
              return (
                <button
                  key={l}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    setOpen(false);
                    router.replace(pathname, { locale: l });
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-card2"
                >
                  <Flag className="h-4 w-6 rounded-[3px]" />
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
