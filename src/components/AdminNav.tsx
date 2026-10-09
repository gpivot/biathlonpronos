import Link from "next/link";

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
    <nav className="mb-6 flex gap-4 border-b border-border pb-3 text-sm">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="text-text-dim hover:text-ice">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
