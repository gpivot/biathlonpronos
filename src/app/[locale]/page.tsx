import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { LogoMark, UserIcon } from "@/components/icons";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboard";
import { nationFlagEmoji } from "@/lib/nationFlags";

export const dynamic = "force-dynamic";

interface HomeData {
  season: { id: string; label: string } | null;
  userId: string | null;
  currentStage: { location: string; country_code: string; coefficient: number } | null;
  nextRace: {
    id: string;
    format: string;
    sex: string | null;
    locks_at: string;
    stages: { location: string; country_code: string };
  } | null;
  leaderboard: LeaderboardRow[];
  favoriteTeam: { nation_code: string; sex: string; nations: { name: string } | null } | null;
}

async function getHomeData(): Promise<HomeData> {
  const supabase = createClient();

  const [{ data: season }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id, label").eq("status", "active").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const user = userResult.user;

  if (!season) {
    return { season: null, userId: user?.id ?? null, currentStage: null, nextRace: null, leaderboard: [], favoriteTeam: null };
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: currentStage }, { data: nextRace }, leaderboard, favoriteTeamResult] = await Promise.all([
    supabase
      .from("stages")
      .select("location, country_code, coefficient")
      .eq("season_id", season.id)
      .lte("starts_on", today)
      .gte("ends_on", today)
      .order("starts_on", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("races")
      .select("id, format, sex, locks_at, stages!inner(location, country_code, season_id)")
      .eq("stages.season_id", season.id)
      .eq("status", "upcoming")
      .order("locks_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    getLeaderboard(supabase, season.id),
    user
      ? supabase
          .from("favorite_teams")
          .select("nation_code, sex, nations(name)")
          .eq("user_id", user.id)
          .eq("season_id", season.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    season,
    userId: user?.id ?? null,
    currentStage,
    nextRace: nextRace as any,
    leaderboard,
    favoriteTeam: favoriteTeamResult.data as any,
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, tFormat, tSex, { season, userId, currentStage, nextRace, leaderboard, favoriteTeam }] = await Promise.all([
    getTranslations("Home"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getHomeData(),
  ]);

  const rankIndex = userId ? leaderboard.findIndex((row) => row.userId === userId) : -1;
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const points = rankIndex >= 0 ? leaderboard[rankIndex].points : 0;
  const top5 = leaderboard.slice(0, 5);
  const loggedInWithSeason = Boolean(season && userId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-auto px-5 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-ice">
              <LogoMark className="h-5 w-5" />
            </div>
            <div className="font-display text-base font-extrabold">
              <span className="text-frost">Biathlon</span>
              <span className="text-ice">Pronos</span>
            </div>
          </div>
          <Link
            href="/compte"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-dim"
          >
            <UserIcon className="h-4.5 w-4.5" />
          </Link>
        </div>

        {loggedInWithSeason ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-card2 to-card p-5">
            <div className="font-display text-[11px] font-bold uppercase tracking-wider text-gold">
              {t("seasonBadge", { label: season!.label })}
            </div>

            {favoriteTeam && (
              <div className="flex items-center gap-2 text-[13px] text-text-dim">
                <span className="text-base">{nationFlagEmoji(favoriteTeam.nation_code)}</span>
                {t("favoriteNationLabel")}
                <span className="font-semibold text-frost">
                  {favoriteTeam.nations?.name ?? favoriteTeam.nation_code} {tSex(favoriteTeam.sex)}
                </span>
              </div>
            )}

            <div className="flex items-end justify-between pt-1">
              <div>
                <div className="font-display text-2xl font-extrabold text-frost">{rank ? `#${rank}` : "–"}</div>
                <div className="text-xs text-text-dim">{t("rankLabel")}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-extrabold text-ice">{points} pts</div>
                <div className="text-xs text-text-dim">{t("pointsLabel")}</div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <Link
                href="/classement"
                className="flex-1 rounded-full bg-ice py-2.5 text-center font-display text-[13px] font-bold text-[#062024]"
              >
                {t("standingsButton")}
              </Link>
              <Link
                href="/pronos"
                className="flex-1 rounded-full border border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-frost"
              >
                {t("mySeasonButton")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <Link
              href="/regles"
              className="flex-1 rounded-full bg-ice py-2.5 text-center font-display text-[13px] font-bold text-[#062024]"
            >
              {t("rulesButton")}
            </Link>
            <Link
              href="/ligues"
              className="flex-1 rounded-full border border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-frost"
            >
              {t("challengeButton")}
            </Link>
          </div>
        )}

        {currentStage && (
          <div className="flex flex-col gap-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("nowTitle")}</div>
            <div className="flex items-center gap-3.5 rounded-2xl border border-gold/30 bg-card px-4 py-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-soft text-lg">
                {nationFlagEmoji(currentStage.country_code)}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="w-fit rounded-full bg-gold-soft px-2 py-0.5 font-display text-[10px] font-bold uppercase text-gold">
                  {t("nowBadge")}
                </div>
                <div className="text-sm font-semibold">{currentStage.location}</div>
              </div>
              {currentStage.coefficient === 2 && (
                <div className="whitespace-nowrap rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
                  {t("coefficientBadge")}
                </div>
              )}
            </div>
          </div>
        )}

        {nextRace && (
          <div className="flex flex-col gap-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("nextRaceTitle")}</div>
            <Link
              href={`/courses/${nextRace.id}`}
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-lg">
                {nationFlagEmoji(nextRace.stages.country_code)}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="text-sm font-semibold">{nextRace.stages.location}</div>
                <div className="text-xs text-text-dim">
                  {tFormat(nextRace.format)}
                  {nextRace.sex ? ` ${tSex(nextRace.sex)}` : ""}
                </div>
              </div>
              <div className="whitespace-nowrap text-xs text-text-dim">
                {new Date(nextRace.locks_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
              </div>
            </Link>
          </div>
        )}

        {!currentStage && !nextRace && (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyState")}
          </div>
        )}

        <Link
          href="/courses"
          className="rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-text-dim"
        >
          {t("seeFullCalendar")}
        </Link>

        {top5.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
              {t("standingsPreviewTitle")}
            </div>
            <div className="flex flex-col gap-2">
              {top5.map((row, index) => (
                <div
                  key={row.userId}
                  className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
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
            <Link
              href="/classement"
              className="rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-text-dim"
            >
              {t("seeFullStandings")}
            </Link>
          </div>
        )}
      </div>

      <BottomNav active="/" />
    </div>
  );
}
