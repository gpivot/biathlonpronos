import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function PronosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = createClient();
  const t = await getTranslations("Pronos");
  const tFormat = await getTranslations("RaceFormat");
  const tSex = await getTranslations("Sex");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell activeNav="/pronos">
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </Shell>
    );
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*, races(*, stages(location))")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });

  const predictedRaceIds = new Set((predictions ?? []).map((p) => p.race_id));

  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("*, stages(location)")
    .eq("status", "upcoming")
    .gt("locks_at", new Date().toISOString())
    .order("locks_at", { ascending: true });

  const openRaces = (upcomingRaces ?? []).filter((race) => !predictedRaceIds.has(race.id));

  const allAthleteIds = Array.from(new Set((predictions ?? []).flatMap((p) => p.athlete_ids ?? [])));
  const { data: athletes } =
    allAthleteIds.length > 0
      ? await supabase.from("athletes").select("id, first_name, last_name").in("id", allAthleteIds)
      : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const athleteNameById = new Map((athletes ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));

  const nationCodes = Array.from(new Set((predictions ?? []).map((p) => p.nation_code).filter(Boolean)));
  const { data: nations } =
    nationCodes.length > 0
      ? await supabase.from("nations").select("code, name").in("code", nationCodes)
      : { data: [] as { code: string; name: string }[] };
  const nationNameByCode = new Map((nations ?? []).map((n) => [n.code, n.name]));

  const raceIds = (predictions ?? []).map((p) => p.race_id);
  const { data: ledger } =
    raceIds.length > 0
      ? await supabase.from("score_ledger").select("race_id, points").eq("user_id", user.id).in("race_id", raceIds)
      : { data: [] as { race_id: string | null; points: number }[] };
  const pointsByRaceId = new Map((ledger ?? []).map((l) => [l.race_id, l.points]));

  return (
    <Shell activeNav="/pronos">
      <Link
        href="/globes"
        className="rounded-2xl border border-border bg-card px-4 py-3.5 text-center font-display text-sm font-bold text-ice"
      >
        {t("seasonPredictionsLink")}
      </Link>

      <div className="flex flex-col gap-3">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("upcomingTitle")}
        </div>
        {openRaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyUpcoming")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openRaces.map((race: any) => (
              <Link
                key={race.id}
                href={`/courses/${race.id}`}
                className="flex items-center gap-3.5 rounded-2xl border border-ice/40 bg-ice-soft px-4 py-3.5"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="text-sm font-semibold">
                    {tFormat(race.format)}
                    {race.sex ? ` ${tSex(race.sex)}` : ""}
                  </div>
                  <div className="text-xs text-text-dim">{race.stages?.location}</div>
                </div>
                <div className="whitespace-nowrap text-xs text-ice">
                  {new Date(race.locks_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("myPredictionsTitle")}
        </div>
        {!predictions || predictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyPredictions")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {predictions.map((prediction: any) => {
              const race = prediction.races;
              const points = pointsByRaceId.get(prediction.race_id);
              const names = prediction.nation_code
                ? nationNameByCode.get(prediction.nation_code) ?? prediction.nation_code
                : (prediction.athlete_ids ?? []).map((id: string) => athleteNameById.get(id) ?? "?").join(", ");

              return (
                <div key={prediction.id} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {tFormat(race.format)}
                      {race.sex ? ` ${tSex(race.sex)}` : ""} — {race.stages?.location}
                    </div>
                    {points != null ? (
                      <div className="whitespace-nowrap font-display text-sm font-bold text-ice">
                        {points} pts
                      </div>
                    ) : (
                      <div className="whitespace-nowrap rounded-full bg-gold-soft px-2.5 py-1 font-display text-[10px] font-bold uppercase text-gold">
                        {t("pendingLabel")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-text-dim">{names}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, activeNav }: { children: React.ReactNode; activeNav: "/pronos" }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-auto px-5 pb-3 pt-6">{children}</div>
      <BottomNav active={activeNav} />
    </div>
  );
}
