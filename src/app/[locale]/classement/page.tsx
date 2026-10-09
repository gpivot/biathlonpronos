import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { getLeaderboard as getLeaderboardRows } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  const supabase = createClient();
  const { data: season } = await supabase.from("seasons").select("id").eq("status", "active").maybeSingle();
  if (!season) return [];
  return getLeaderboardRows(supabase, season.id);
}

interface StreakRow {
  userId: string;
  pseudo: string;
  currentStreak: number;
}

async function getStreakLeaderboard(): Promise<StreakRow[]> {
  const supabase = createClient();

  const { data: season } = await supabase.from("seasons").select("id").eq("status", "active").maybeSingle();
  if (!season) return [];

  const { data: streaks } = await supabase
    .from("streak_counters")
    .select("user_id, current_streak, profiles(pseudo)")
    .eq("season_id", season.id)
    .gt("current_streak", 0)
    .order("current_streak", { ascending: false })
    .limit(10);

  return (streaks ?? []).map((s) => ({
    userId: s.user_id,
    pseudo: (s.profiles as any)?.pseudo ?? "?",
    currentStreak: s.current_streak,
  }));
}

export default async function ClassementPage() {
  const [leaderboard, streakLeaderboard] = await Promise.all([getLeaderboard(), getStreakLeaderboard()]);
  const t = await getTranslations("Classement");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-3 pt-6">
        <div className="font-display text-lg font-bold">{t("title")}</div>

        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyState")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((row, index) => (
              <div
                key={row.userId}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5"
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                    index === 0 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 text-sm font-semibold">{row.pseudo}</div>
                <div className="font-display text-sm font-bold text-ice">{row.points} pts</div>
              </div>
            ))}
          </div>
        )}

        {streakLeaderboard.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-red">
              {t("streakTitle")}
            </div>
            {streakLeaderboard.map((row, index) => (
              <div
                key={row.userId}
                className="flex items-center gap-3.5 rounded-2xl border border-red/30 bg-card px-4 py-3"
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red/20 font-display text-xs font-bold text-red">
                  {index + 1}
                </div>
                <div className="flex-1 text-sm font-semibold">{row.pseudo}</div>
                <div className="font-display text-sm font-bold text-red">{row.currentStreak}/10</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="/classement" />
    </div>
  );
}
