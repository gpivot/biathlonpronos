import { useTranslations } from "next-intl";
import { NO_BADGES, X2_PER_SEASON, type PlayerBadges } from "@/lib/playerBadges";

/** Dossard jaune du leader du général (comme en Coupe du monde de biathlon). */
export function LeaderBib({ className = "h-5 w-5" }: { className?: string }) {
  const t = useTranslations("Badges");
  return <Bib className={className} label={t("leader")} fill="#FFD43B" stroke="#B88A00" />;
}

/** Dossard rouge : leader d'une étape (dans le classement « Par étapes ») ou étapes gagnées. */
export function StageLeaderBib({ className = "h-5 w-5", label }: { className?: string; label?: string }) {
  const t = useTranslations("Badges");
  return <Bib className={className} label={label ?? t("stageLeader")} fill="#E8414B" stroke="#9C1C24" />;
}

function Bib({ className, label, fill, stroke }: { className: string; label: string; fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} className={`flex-shrink-0 ${className}`}>
      <title>{label}</title>
      <path
        d="M7.5 2.5h2.2c.6 1.6 1.3 2.4 2.3 2.4s1.7-.8 2.3-2.4h2.2v4.2c1.6.7 2.5 2 2.5 3.8v11H5v-11c0-1.8.9-3.1 2.5-3.8z"
        fill={fill}
        stroke={stroke}
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
 * Pictos d'un joueur à côté de son pseudo : dossard jaune s'il mène le classement général (ou de
 * ligue) sur la saison, dossard rouge s'il mène l'étape affichée et avec le nombre d'étapes
 * gagnées, ⚡ bonus ×2 utilisés (« 1/3 »), 🍾 courses gagnées, ⭐ pronos parfaits, ❄️ Pépite.
 */
export function PlayerBadgesRow({
  badges,
  leader = false,
  stageLeader = false,
}: {
  badges: PlayerBadges | undefined;
  /** En tête du classement de la saison : dossard jaune. */
  leader?: boolean;
  /** En tête de l'étape affichée (classement « Par étapes ») : dossard rouge. */
  stageLeader?: boolean;
}) {
  const t = useTranslations("Badges");
  const b = { ...NO_BADGES, ...badges };
  if (!leader && !stageLeader && !b.x2Used && !b.raceWins && !b.stageWins && !b.perfectPicks && !b.pepites) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-1.5 font-display text-[12px] font-bold">
      {leader && <LeaderBib />}
      {(stageLeader || b.stageWins > 0) && (
        <span className="flex items-center whitespace-nowrap text-red">
          <StageLeaderBib
            label={b.stageWins > 0 ? t("stageWins", { count: b.stageWins }) : t("stageLeader")}
          />
          {b.stageWins > 0 ? b.stageWins : ""}
        </span>
      )}
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
      {b.perfectPicks > 0 && (
        <span title={t("perfectPicks", { count: b.perfectPicks })} className="whitespace-nowrap text-gold">
          <span className="text-[14px]">⭐</span>{b.perfectPicks}
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
