import { useTranslations } from "next-intl";

/** Rond noir avec un chiffre blanc (comme sur biathlonworld) : ici, le total des fautes au tir. */
export function ShootingTotalDot({ misses }: { misses: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-black px-1 font-display text-[10px] font-bold leading-none text-white ring-1 ring-white/25"
    >
      {misses}
    </span>
  );
}

/**
 * Fautes au tir synthétisées en un seul rond noir affichant le total (le détail tir par tir reste
 * dans l'infobulle). Un 0 vaut sans-faute (Gâchette) : le picto 🎯 n'est alors plus affiché à côté
 * du nom. Rien si les tirs n'ont pas été saisis.
 */
export function ShootingDots({ shootings }: { shootings: number[] | null | undefined }) {
  const t = useTranslations("Home");
  if (!shootings || shootings.length === 0) return null;
  const label = t("shootingsLabel", { shots: shootings.join("+") });
  const total = shootings.reduce((sum, misses) => sum + misses, 0);
  return (
    <span title={label} aria-label={label} className="flex flex-shrink-0 items-center">
      <ShootingTotalDot misses={total} />
    </span>
  );
}

/** Vrai si les tirs sont saisis : le rond « 0 » remplace alors le picto Gâchette 🎯. */
export function hasShootings(shootings: number[] | null | undefined) {
  return !!shootings && shootings.length > 0;
}
