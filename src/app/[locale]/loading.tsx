import { BottomNavLoading } from "@/components/BottomNavLoading";

/**
 * Écran affiché immédiatement pendant que le serveur prépare la page (clic sur un lien, une
 * notification, rafraîchissement) : la barre de navigation reste en place et des blocs gris
 * annoncent le contenu, au lieu d'un écran figé sur la page précédente.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col" aria-busy="true">
      <div className="flex flex-1 flex-col gap-5 px-5 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="h-9 w-40 animate-pulse rounded-full bg-card" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-card" />
        </div>
        <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
      <BottomNavLoading />
    </div>
  );
}
