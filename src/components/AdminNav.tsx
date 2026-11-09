"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeftIcon } from "./icons";

const items = [
  { href: "/admin", label: "Calendrier & résultats", matches: ["/admin/races", "/admin/calendrier"] },
  { href: "/admin/athletes", label: "Athlètes & cotes", matches: ["/admin/athletes"] },
  { href: "/admin/cartes", label: "Cartes bonus", matches: ["/admin/cartes"] },
  { href: "/admin/joueurs", label: "Joueurs & rôles", matches: ["/admin/joueurs"] },
  { href: "/admin/horloge", label: "Horloge simulée", matches: ["/admin/horloge"] },
  { href: "/admin/notifications", label: "Notifications", matches: ["/admin/notifications"] },
  { href: "/admin/messages", label: "Messages", matches: ["/admin/messages"] },
];

/**
 * Onglets du back-office. Sur téléphone : une seule ligne qui défile de côté (l'onglet actif est
 * ramené à l'écran), flèche retour fixe à gauche, sous la barre d'état du téléphone.
 */
export function AdminNav({ homeHref = "/fr" }: { homeHref?: string }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav className="-mx-4 mb-6 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 text-sm backdrop-blur sm:-mx-6 sm:px-6">
      <Link
        href={homeHref}
        aria-label="Retour à l'accueil"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim hover:text-ice"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Link>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive = pathname === item.href || item.matches.some((m) => pathname.startsWith(m));
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 ${
                isActive ? "border-ice bg-ice-soft font-semibold text-ice" : "border-border text-text-dim hover:text-ice"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
