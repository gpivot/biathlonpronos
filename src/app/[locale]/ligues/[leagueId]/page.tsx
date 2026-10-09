import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const supabase = createClient();
  const t = await getTranslations("Ligues");

  const { data: league } = await supabase.from("leagues").select("*").eq("id", leagueId).single();
  if (!league) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("league_memberships")
    .select("user_id, profiles(pseudo)")
    .eq("league_id", leagueId);

  const isMember = !!user && (memberships ?? []).some((m) => m.user_id === user.id);

  let leaderboard: { userId: string; pseudo: string; points: number }[] = [];
  if (isMember && memberships && memberships.length > 0) {
    const memberIds = memberships.map((m) => m.user_id);
    const pseudoByUserId = new Map(memberships.map((m: any) => [m.user_id, m.profiles?.pseudo ?? "?"]));

    const { data: ledger } = await supabase
      .from("score_ledger")
      .select("user_id, points")
      .eq("season_id", league.season_id)
      .in("user_id", memberIds);

    const totals = new Map<string, number>();
    for (const entry of ledger ?? []) {
      totals.set(entry.user_id, (totals.get(entry.user_id) ?? 0) + entry.points);
    }

    leaderboard = memberIds
      .map((userId) => ({ userId, pseudo: pseudoByUserId.get(userId) ?? "?", points: totals.get(userId) ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-3 pt-6">
        <Link href="/ligues" className="text-xs text-text-dim underline">
          {t("backToList")}
        </Link>
        <div className="font-display text-lg font-bold">{league.name}</div>

        {!isMember ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("notAMember")}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span className="text-xs text-text-dim">{t("inviteCodeLabel")}</span>
              <span className="font-display text-base font-bold tracking-widest text-ice">
                {league.invite_code}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {leaderboard.map((row, index) => (
                <div
                  key={row.userId}
                  className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ice-soft font-display text-sm font-bold text-ice">
                    {index + 1}
                  </div>
                  <div className="flex-1 text-sm font-semibold">{row.pseudo}</div>
                  <div className="font-display text-sm font-bold text-ice">{row.points} pts</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="/ligues" />
    </div>
  );
}
