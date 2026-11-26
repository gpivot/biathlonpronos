/**
 * « % des joueurs » (voir src/lib/pickShares.ts) : dégradé bleu glacier en fond de ligne, comme les
 * barres de points de la fiche joueur (l'or reste réservé aux points). Le chiffre n'est pas
 * affiché : il apparaît dans une bulle au survol de la ligne (ou au toucher sur mobile).
 * La ligne parente doit avoir les classes `group relative isolate`.
 */
export function PickShareBar({ pct, label }: { pct: number; label: string }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <span
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-ice/35 to-ice/10"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-10 z-20 mb-1.5 whitespace-nowrap rounded-lg border border-ice/40 bg-card2 px-2.5 py-1 font-display text-[11px] font-bold text-frost opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}
