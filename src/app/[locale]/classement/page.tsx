import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { Link } from "@/i18n/navigation";
import { HeaderActions } from "@/components/HeaderActions";
import { ArrowLeftIcon } from "@/components/icons";
import { getLeaderboard as getLeaderboardRows } from "@/lib/leaderboard";
import { PlayerSeasonButton } from "./PlayerSeasonButton";
import { StreakCard } from "./StreakCard";

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

async function getStreakLeaderboard(): Promise<{ rows: StreakRow[]; myStreak: number | null }> {
  const supabase = createClient();

  const [{ data: season }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!season) return { rows: [], myStreak: null };

  const user = userResult.user;
  const { data: mine } = user
    ? await supabase.from("streak_counters").select("current_streak").eq("season_id", season.id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const myStreak = user ? mine?.current_streak ?? 0 : null;

  const { data: streaks } = await supabase
    .from("streak_counters")
    .select("user_id, current_streak, profiles(pseudo)")
    .eq("season_id", season.id)
    .gt("current_streak", 0)
    .order("current_streak", { ascending: false })
    .limit(10);

  const rows = (streaks ?? []).map((s) => ({
    userId: s.user_id,
    pseudo: (s.profiles as any)?.pseudo ?? "?",
    currentStreak: s.current_streak,
  }));
  return { rows, myStreak };
}

export default async function ClassementPage() {
  const [leaderboard, { rows: streakLeaderboard, myStreak }] = await Promise.all([getLeaderboard(), getStreakLeaderboard()]);
  const t = await getTranslations("Classement");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="font-display text-lg font-bold">{t("title")}</div>
          <HeaderActions />
        </div>

        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyState")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((row, index) => (
              <PlayerSeasonButton
                key={row.userId}
                userId={row.userId}
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
              </PlayerSeasonButton>
            ))}
          </div>
        )}

        {myStreak != null && <StreakCard current={myStreak} />}

        {streakLeaderboard.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("streakTitle")}</div>
            {streakLeaderboard.map((row, index) => (
              <PlayerSeasonButton
                key={row.userId}
                userId={row.userId}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ice-soft font-display text-xs font-bold text-ice">
                  {index + 1}
                </div>
                <div className="flex-1 text-sm font-semibold">{row.pseudo}</div>
                <div className="font-display text-sm font-bold text-ice">🔥 {row.currentStreak}/10</div>
              </PlayerSeasonButton>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="/classement" />
    </div>
  );
}
