/** Chargement de la page de connexion : sans barre de navigation (la page n'en a pas). */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5" aria-busy="true">
      <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-card" />
      <div className="h-12 animate-pulse rounded-2xl bg-card" />
      <div className="h-12 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
