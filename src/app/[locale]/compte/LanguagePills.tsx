"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { FLAGS, FlagFR } from "@/components/flags";

// Choix de la langue sur la page Profil : une pastille par langue, la langue courante surlignée.
export function LanguagePills() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {routing.locales.map((l) => {
        const { Flag, label } = FLAGS[l] ?? { Flag: FlagFR, label: l };
        const isCurrent = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => !isCurrent && router.replace(pathname, { locale: l })}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-display text-[13px] font-bold ${
              isCurrent ? "bg-ice text-on-ice" : "bg-card2 text-frost hover:bg-border"
            }`}
          >
            <Flag className="h-3 w-[18px] rounded-[2px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
