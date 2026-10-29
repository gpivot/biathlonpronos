import { CheckIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { FuseeGachetteBadges, formatPoints } from "@/components/PredictionBreakdown";
import type { RaceResultRow } from "@/lib/lastResult";
import type { RacePlayerRow } from "@/lib/racePlayers";

/** Ligne du classement de la course : étoile et contour doré pour le trio du Prono parfait. */
export function ResultRow({ row }: { row: RaceResultRow }) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3 ${
        row.perfect ? "border-gold" : row.mine ? "border-ice/60" : "border-border"
      } ${row.mine ? "bg-ice-soft" : "bg-card"}`}
    >
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
          row.rank === 1 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
        }`}
      >
        {row.rank}
      </div>
      <div className="text-base">{nationFlagEmoji(row.nationCode)}</div>
      <div className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-semibold">
        <span className="truncate">{row.name}</span>
        {row.perfect && <span className="text-[13px]">⭐</span>}
        <FuseeGachetteBadges fusee={row.fusee} gachette={row.gachette} />
      </div>
      {row.mine && <CheckIcon className="h-4 w-4 flex-shrink-0 text-ice" />}
      {row.points != null && (
        <div className="whitespace-nowrap font-display text-[13px] font-bold text-gold">{formatPoints(row.points)}</div>
      )}
    </div>
  );
}

export function PlayerRow({ player, mine }: { player: RacePlayerRow; mine: boolean }) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3 ${mine ? "border-ice/60 bg-ice-soft" : "border-border bg-card"}`}
    >
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
          player.rank === 1 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
        }`}
      >
        {player.rank}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold">{player.pseudo}</div>
      <div className="whitespace-nowrap font-display text-[13px] font-bold text-ice">{Math.round(player.points * 10) / 10} pts</div>
    </div>
  );
}
