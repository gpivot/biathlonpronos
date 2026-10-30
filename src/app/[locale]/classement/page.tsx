import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { Link } from "@/i18n/navigation";
import { HeaderActions } from "@/components/HeaderActions";
import { ArrowLeftIcon } from "@/components/icons";
import { getClock } from "@/lib/clock";
import { getLeaderboard } from "@/lib/leaderboard";
import { getPlayerBadges, type PlayerBadges } from "@/lib/playerBadges";
import { HelpButton } from "@/components/HelpButton";
import { LeaderBib, PlayerBadgesRow } from "@/components/PlayerBadgesRow";
import { nationFlagEmoji } from "@/lib/nationFlags";
import {
  buildStandings,
  getLeagueMembers,
  getRacesStandings,
  getStandingsStages,
  isStageOngoing,
  pickDefaultStandingsStageId,
  type StandingsRow,
} from "@/lib/standings";
import { PlayerSeasonButton } from "./PlayerSeasonButton";
import { StandingsFilters, type StandingsFilterOptions, type StandingsFilterState } from "./StandingsFilters";

export const dynamic = "force-dynamic";

interface StreakRow {
  userId: string;
  pseudo: string;
  currentStreak: number;
}

async function getStreakLeaderboard(supabase: ReturnType<typeof createClient>, seasonId: string): Promise<StreakRow[]> {
  const { data: streaks } = await supabase
    .from("streak_counters")
    .select("user_id, current_streak, profiles(pseudo)")
    .eq("season_id", seasonId)
    .gt("current_streak", 0)
    .order("current_streak", { ascending: false })
    .limit(10);

  return (streaks ?? []).map((s) => ({
    userId: s.user_id,
    pseudo: (s.profiles as any)?.pseudo ?? "?",
    currentStreak: s.current_streak,
  }));
}

type SearchParams = { portee?: string; ligue?: string; periode?: string; etape?: string; course?: string };

export default async function ClassementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [t, tFormat, tSex, tBadges] = await Promise.all([
    getTranslations("Classement"),
    getTranslations("RaceFormat"),
    getTranslations("Sex"),
    getTranslations("Badges"),
  ]);
  const raceLabel = (race: { format: string; sex: string }) =>
    race.format.startsWith("relais") ? tFormat(race.format) : `${tFormat(race.format)} ${tSex(race.sex)}`;

  const supabase = createClient();
  const [{ data: season }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const userId = userResult.user?.id ?? null;
  const { now } = await getClock();

  const [stages, leagueRows] = await Promise.all([
    season ? getStandingsStages(supabase, season.id, now) : Promise.resolve([]),
    season && userId
      ? supabase.from("league_memberships").select("leagues!inner(id, name, season_id)").eq("user_id", userId).eq("leagues.season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const leagues = ((leagueRows.data ?? []) as any[])
    .map((m) => m.leagues)
    .filter(Boolean)
    .map((l: any) => ({ id: l.id as string, name: l.name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filtres demandés dans l'URL, ramenés à des valeurs valides.
  const scope: StandingsFilterState["scope"] = query.portee === "ligue" ? "league" : "general";
  const leagueId = scope === "league" ? leagues.find((l) => l.id === query.ligue)?.id ?? leagues[0]?.id ?? null : null;
  const period: StandingsFilterState["period"] = query.periode === "etapes" ? "stages" : "season";
  const stage = period === "stages" ? stages.find((s) => s.id === query.etape) ?? stages.find((s) => s.id === pickDefaultStandingsStageId(stages)) ?? null : null;
  const race = stage?.races.find((r) => r.id === query.course) ?? null;
  const state: StandingsFilterState = { scope, leagueId, period, stageId: stage?.id ?? null, raceId: race?.id ?? null };
  const options: StandingsFilterOptions = {
    leagues,
    stages: stages.map((s) => ({
      id: s.id,
      label: `${nationFlagEmoji(s.country_code)} ${s.location}`,
      races: s.races.map((r) => ({ id: r.id, label: raceLabel(r) })),
    })),
  };

  const noLeague = scope === "league" && !leagueId;
  let rows: StandingsRow[] = [];
  let showPicks = false;
  let streakLeaderboard: StreakRow[] = [];
  let badges = new Map<string, PlayerBadges>();
  if (season && !noLeague) {
    const [members, playerBadges] = await Promise.all([
      leagueId ? getLeagueMembers(supabase, leagueId) : Promise.resolve(null),
      getPlayerBadges(supabase, season.id),
    ]);
    badges = playerBadges;
    if (period === "season") {
      const [leaderboard, streaks] = await Promise.all([
        getLeaderboard(supabase, season.id),
        scope === "general" ? getStreakLeaderboard(supabase, season.id) : Promise.resolve([]),
      ]);
      rows = buildStandings(leaderboard, members, null);
      streakLeaderboard = streaks;
    } else if (stage) {
      // Pronostics visibles : sur une course déjà partie, ou sur l'étape entière quand elle est en cours.
      showPicks = race ? race.displayStatus !== "upcoming" : isStageOngoing(stage);
      rows = await getRacesStandings(supabase, race ? [race] : stage.races, members, showPicks);
    }
  }

  const emptyMessage = period === "season" ? t("emptyState") : stage ? t("emptyStage") : t("noStages");

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
          <HelpButton
            title={tBadges("helpTitle")}
            openLabel={tBadges("helpTitle")}
            closeLabel={t("close")}
            items={[
              { icon: <LeaderBib className="h-5 w-5" />, text: tBadges("helpLeader") },
              { icon: "⚡", text: tBadges("helpX2") },
              { icon: "🍾", text: tBadges("helpWins") },
              { icon: "❄️", text: tBadges("helpPepite") },
            ]}
          />
          <HeaderActions />
        </div>

        <StandingsFilters state={state} options={options} />

        {noLeague ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("noLeague")}
            <Link
              href="/ligues"
              className="self-start rounded-full bg-ice px-4 py-2 font-display text-[13px] font-bold text-on-ice"
            >
              {t("noLeagueButton")}
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">{emptyMessage}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <PlayerSeasonButton
                key={row.userId}
                userId={row.userId}
                className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${
                  row.userId === userId ? "border-ice/60 bg-ice-soft" : "border-border bg-card"
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                    row.rank === 1 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
                  }`}
                >
                  {row.rank}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="max-w-full truncate text-sm font-semibold">{row.pseudo}</span>
                    <PlayerBadgesRow badges={badges.get(row.userId)} leader={row.rank === 1 && row.points > 0} />
                  </div>
                  {showPicks &&
                    (row.picks && row.picks.length > 0 ? (
                      row.picks.map((pick) => (
                        <div key={pick.raceId} className="text-xs leading-snug text-frost">
                          {!race && <div className="text-[11px] text-text-dim">{raceLabel(pick)}</div>}
                          {pick.names}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-text-dim">{t("noPicks")}</div>
                    ))}
                </div>
                <div className="whitespace-nowrap font-display text-sm font-bold text-ice">{row.points} pts</div>
              </PlayerSeasonButton>
            ))}
          </div>
        )}

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
