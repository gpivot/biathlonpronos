import { useTranslations } from "next-intl";
import { X2_PER_SEASON, type PlayerBadges } from "@/lib/playerBadges";

/** Dossard jaune du leader (comme en Coupe du monde de biathlon). */
export function LeaderBib({ className = "h-5 w-5" }: { className?: string }) {
  const t = useTranslations("Badges");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={t("leader")} className={`flex-shrink-0 ${className}`}>
      <title>{t("leader")}</title>
      <path
        d="M7.5 2.5h2.2c.6 1.6 1.3 2.4 2.3 2.4s1.7-.8 2.3-2.4h2.2v4.2c1.6.7 2.5 2 2.5 3.8v11H5v-11c0-1.8.9-3.1 2.5-3.8z"
        fill="#FFD43B"
        stroke="#B88A00"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <rect x="8.2" y="11" width="7.6" height="6.2" rx="1" fill="#fff" />
      <text x="12" y="16" textAnchor="middle" fontSize="5.6" fontWeight="800" fill="#1a1a1a" fontFamily="sans-serif">
        1
      </text>
    </svg>
  );
}

/**
 * Pictos d'un joueur à côté de son pseudo : dossard jaune s'il mène le classement affiché,
 * ⚡ bonus ×2 utilisés (« 1/3 »), 🍾 courses gagnées, ❄️ Pépite révélée.
 */
export function PlayerBadgesRow({ badges, leader = false }: { badges: PlayerBadges | undefined; leader?: boolean }) {
  const t = useTranslations("Badges");
  const b = badges ?? { x2Used: 0, raceWins: 0, pepites: 0 };
  if (!leader && !b.x2Used && !b.raceWins && !b.pepites) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-1.5 font-display text-[12px] font-bold">
      {leader && <LeaderBib />}
      {b.x2Used > 0 && (
        <span title={t("x2Used", { used: b.x2Used, max: X2_PER_SEASON })} className="whitespace-nowrap text-gold">
          <span className="text-[14px]">⚡</span>{b.x2Used}/{X2_PER_SEASON}
        </span>
      )}
      {b.raceWins > 0 && (
        <span title={t("raceWins", { count: b.raceWins })} className="whitespace-nowrap text-frost">
          <span className="text-[14px]">🍾</span>{b.raceWins}
        </span>
      )}
      {b.pepites > 0 && (
        <span title={t("pepite", { count: b.pepites })} className="whitespace-nowrap text-ice">
          <span className="text-[14px]">❄️</span>{b.pepites > 1 ? b.pepites : ""}
        </span>
      )}
    </span>
  );
}
