import Link from "next/link";
import { ArrowLeftIcon } from "./icons";

const items = [
  { href: "/admin", label: "Résultats" },
  { href: "/admin/seasons", label: "Saisons" },
  { href: "/admin/athletes", label: "Athlètes & cotes" },
  { href: "/admin/relais", label: "Cotes de relais" },
  { href: "/admin/import", label: "Import CSV" },
  { href: "/admin/stages", label: "Étapes & courses" },
  { href: "/admin/globes", label: "Globes de saison" },
];

export function AdminNav() {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-sm">
      <Link
        href="/fr"
        aria-label="Retour à l'accueil"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim hover:text-ice"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Link>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="text-text-dim hover:text-ice">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
