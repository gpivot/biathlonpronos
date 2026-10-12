import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { UserIcon } from "@/components/icons";

// Boutons ronds en haut à droite des onglets (Accueil, Calendrier, Classement, Ma saison, Ligues) :
// choix de la langue et accès au profil, comme sur VéloPronos.
export function HeaderActions() {
  return (
    <div className="ml-auto flex flex-shrink-0 items-center gap-2">
      <LocaleSwitcher />
      <Link
        href="/compte"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-dim"
      >
        <UserIcon className="h-4.5 w-4.5" />
      </Link>
    </div>
  );
}
