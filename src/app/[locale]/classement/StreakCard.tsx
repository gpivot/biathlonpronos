import { getTranslations } from "next-intl/server";
import { STREAK_TARGET } from "@/lib/scoring/constants";

/** « Série en cours » du joueur connecté : courses d'affilée avec des points, sur 10 pour une carte bonus. */
export async function StreakCard({ current }: { current: number }) {
  const t = await getTranslations("Classement");
  const remaining = STREAK_TARGET - current;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span className="text-xl">🔥</span>
        <div className="flex-1 font-display text-[15px] font-extrabold uppercase tracking-wide">{t("streakCardTitle")}</div>
        <div className="font-display text-xl font-extrabold tabular-nums text-ice">
          {current} / {STREAK_TARGET}
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: STREAK_TARGET }, (_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i < current ? "bg-ice" : "bg-border"}`} />
        ))}
      </div>
      <div className="text-center font-display text-[12px] font-semibold uppercase tracking-wide text-text-dim">
        {t("streakCardRemaining", { count: remaining })}
      </div>
    </div>
  );
}
