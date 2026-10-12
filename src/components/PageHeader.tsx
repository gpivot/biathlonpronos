import { Link } from "@/i18n/navigation";

// Bandeau en dégradé des pages d'information (Support, Confidentialité, CGU), repris de VéloPronos.
export function PageHeader({
  backLabel,
  emoji,
  title,
  subtitle,
}: {
  backLabel: string;
  emoji?: string;
  title: string;
  subtitle?: string;
}) {
  // Sur mobile, marge haute plus grande pour passer sous le sélecteur de langue (fixe, en haut à droite).
  return (
    <header className="relative bg-gradient-to-r from-blue to-ice px-5 pb-8 pt-[6.5rem] text-center text-white sm:pt-10">
      <Link href="/" className="absolute left-4 top-3 font-display text-xs font-bold hover:opacity-80">
        ‹ {backLabel}
      </Link>
      <div className="font-display text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">Biathlonpronos</div>
      <h1 className="mt-1 font-display text-3xl font-extrabold">
        {emoji && <span className="mr-2">{emoji}</span>}
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-white/90">{subtitle}</p>}
    </header>
  );
}
