import { useTranslations } from "next-intl";

/**
 * Fautes au tir en ronds noirs, un rond par tir avec son nombre de fautes en blanc (comme sur
 * biathlonworld) : 2 au sprint et en relais, 4 sinon. Rien si les tirs n'ont pas été saisis.
 */
export function ShootingDots({ shootings }: { shootings: number[] | null | undefined }) {
  const t = useTranslations("Home");
  if (!shootings || shootings.length === 0) return null;
  const label = t("shootingsLabel", { shots: shootings.join("+") });
  return (
    <span title={label} aria-label={label} className="flex flex-shrink-0 items-center gap-0.5">
      {shootings.map((misses, i) => (
        <span
          key={i}
          aria-hidden
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black font-display text-[10px] font-bold leading-none text-white ring-1 ring-white/25"
        >
          {misses}
        </span>
      ))}
    </span>
  );
}
