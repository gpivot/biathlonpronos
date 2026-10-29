import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, CheckIcon, ClockIcon } from "@/components/icons";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { getClock } from "@/lib/clock";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { PredictionForm, type AthleteWithOdds } from "./PredictionForm";
import { RelayPredictionForm, type NationWithOdds } from "./RelayPredictionForm";
import { FondueButton } from "./FondueButton";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { displayedSex } from "@/lib/raceLabel";
import { RELAY_FORMATS, previousRaceForGrilling } from "@/lib/grilling";
import { getRaceResult } from "@/lib/lastResult";
import { FuseeGachetteBadges, FuseeGachetteLegend, PredictionBreakdown, formatPoints } from "@/components/PredictionBreakdown";

export const dynamic = "force-dynamic";

export default async function RacePage({
  params,
}: {
  params: Promise<{ locale: string; raceId: string }>;
}) {
  const { locale, raceId } = await params;
  const supabase = createClient();
  const t = await getTranslations("Race");
  const tFormat = await getTranslations("RaceFormat");
  const tSex = await getTranslations("Sex");

  const { data: race } = await supabase.from("races").select("*, stages(*)").eq("id", raceId).single();

  if (!race) notFound();

  const stage = race.stages as { id: string; location: string; country_code: string; season_id: string; coefficient: 1 | 2 };
  const isRelay = RELAY_FORMATS.includes(race.format);
  const { now } = await getClock();
  const displayStatus = getRaceDisplayStatus(race, now);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  let athletesWithOdds: AthleteWithOdds[] = [];
  let nationsWithOdds: NationWithOdds[] = [];
  let initialAthleteSelection: string[] = [];
  let initialNationSelection: string | null = null;
  let grilledAthleteIds: string[] = [];
  let availableCards: { id: string; card_type: string }[] = [];
  let initialBonusX2 = false;
  let initialCardUsed: string | null = null;
  let initialCardTarget: string | null = null;

  // §7 — bonus ×2 personnel : 3 fois par saison, jamais sur une course
  // spéciale ni sur une étape Mondiaux/JO (déjà comptée double).
  const x2Eligible = !race.special_rule && stage.coefficient !== 2;
  let x2UsesRemaining = 0;

  if (user) {
    const [{ data: cards }, { count: x2UsedCount }] = await Promise.all([
      supabase.from("bonus_cards").select("id, card_type").eq("user_id", user.id).eq("season_id", stage.season_id).eq("status", "available"),
      supabase
        .from("predictions")
        .select("id, races!inner(stages!inner(season_id))", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("bonus_x2_used", true)
        .eq("races.stages.season_id", stage.season_id),
    ]);
    availableCards = cards ?? [];
    x2UsesRemaining = Math.max(0, 3 - (x2UsedCount ?? 0));
  }

  if (isRelay) {
    const { data: odds } = await supabase
      .from("odds")
      .select("nation_code, value, nations(name)")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null);

    nationsWithOdds = (odds ?? [])
      .map((o: any) => ({ nation_code: o.nation_code, name: o.nations?.name ?? o.nation_code, value: o.value }))
      .sort((a: NationWithOdds, b: NationWithOdds) => a.value - b.value);

    if (user) {
      const { data: existing } = await supabase
        .from("predictions")
        .select("nation_code, bonus_x2_used")
        .eq("user_id", user.id)
        .eq("race_id", race.id)
        .maybeSingle();
      initialNationSelection = existing?.nation_code ?? null;
      initialBonusX2 = existing?.bonus_x2_used ?? false;
    }
  } else {
    const { data: odds } = await supabase
      .from("odds")
      .select("athlete_id, value, athletes(first_name, last_name, nation_code, sex)")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null);

    athletesWithOdds = (odds ?? [])
      .filter((o: any) => !race.sex || o.athletes?.sex === race.sex)
      .map((o: any) => ({
        athlete_id: o.athlete_id,
        first_name: o.athletes?.first_name ?? "",
        last_name: o.athletes?.last_name ?? "",
        nation_code: o.athletes?.nation_code ?? "",
        value: o.value,
      }))
      .sort((a: AthleteWithOdds, b: AthleteWithOdds) => a.value - b.value);

    if (user) {
      const [{ data: existing }, { data: stageRaces }, { count: fondueOnThisRace }] = await Promise.all([
        supabase
          .from("predictions")
          .select("athlete_ids, bonus_x2_used, bonus_card_used, bonus_card_target_athlete_id")
          .eq("user_id", user.id)
          .eq("race_id", race.id)
          .maybeSingle(),
        supabase.from("races").select("id, format, sex, locks_at").eq("stage_id", stage.id),
        supabase
          .from("bonus_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("card_type", "fondue")
          .eq("status", "used")
          .eq("used_on_race_id", race.id),
      ]);
      initialAthleteSelection = existing?.athlete_ids ?? [];

      // §2 — grillés = biathlètes choisis sur la course précédente de l'étape
      // (même sexe), sauf si la carte Fondue a été jouée sur cette course.
      // Calculé à partir des pronostics : le pronostic de la course affichée
      // ne grille donc jamais ses propres choix, et il reste modifiable.
      const previousRace = previousRaceForGrilling(race, stageRaces ?? []);
      if (previousRace && !fondueOnThisRace) {
        const { data: previousPrediction } = await supabase
          .from("predictions")
          .select("athlete_ids")
          .eq("user_id", user.id)
          .eq("race_id", previousRace.id)
          .maybeSingle();
        grilledAthleteIds = previousPrediction?.athlete_ids ?? [];
      }
      initialBonusX2 = existing?.bonus_x2_used ?? false;
      initialCardUsed = existing?.bonus_card_used ?? null;
      initialCardTarget = existing?.bonus_card_target_athlete_id ?? null;
    }
  }

  // Poursuite : ordre de départ = classement du sprint de l'étape (même sexe).
  let startOrder: Record<string, number> = {};
  if (race.format === "poursuite" && displayStatus === "upcoming") {
    const { data: sprint } = await supabase
      .from("races")
      .select("id")
      .eq("stage_id", stage.id)
      .eq("format", "sprint")
      .eq("sex", race.sex)
      .lt("locks_at", race.locks_at)
      .order("locks_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sprint) {
      const { data: sprintResults } = await supabase.from("race_results").select("athlete_id, rank").eq("race_id", sprint.id);
      startOrder = Object.fromEntries((sprintResults ?? []).filter((r) => r.athlete_id).map((r) => [r.athlete_id, r.rank]));
    }
  }

  const hasOdds = isRelay ? nationsWithOdds.length > 0 : athletesWithOdds.length > 0;
  const hasPrediction = isRelay ? Boolean(initialNationSelection) : initialAthleteSelection.length > 0;

  // Course notée : pronostic détaillé (place et points par choix) et classement avec les points du barème.
  const raceResult = displayStatus === "finished" ? await getRaceResult(supabase, race.id, user?.id ?? null) : null;
  const results = raceResult?.results ?? [];
  const pointsEarned = raceResult?.prediction?.points ?? 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <Link
            href="/courses"
            aria-label={t("backToCalendar")}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex-1 text-center font-display text-[15px] font-bold">
            {tFormat(race.format)}
            {displayedSex(race) ? ` ${tSex(displayedSex(race)!)}` : ""}
          </div>
          {/* Équilibre la flèche pour garder le titre centré. */}
          <div className="h-8 w-8 flex-shrink-0" />
        </div>

        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-gradient-to-br from-card2 to-card px-4 py-4">
          <div className="flex items-center gap-2 font-display text-[13px] font-bold text-ice">
            <ClockIcon className="h-4 w-4" />
            {displayStatus === "upcoming"
              ? t("lockLabel", {
                  date: new Date(race.locks_at).toLocaleString(locale, { timeZone: DISPLAY_TIME_ZONE,
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })
              : t(`status_${displayStatus}`)}
          </div>
          <div className="font-display text-base font-bold">{stage.location}</div>
        </div>

        {race.special_rule && (
          <div className="rounded-2xl border border-gold/35 bg-gold-soft px-3.5 py-3 text-[12px] leading-relaxed text-frost">
            {t("specialRulePrefix")} <span className="font-semibold text-gold">{race.special_rule.replace(/_/g, " ")}</span>{" "}
            {t("specialRuleHint")}
          </div>
        )}

        {displayStatus === "upcoming" &&
          (!hasOdds ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
              {t("noOddsMessage", { format: race.format })}
            </div>
          ) : (
            <>
              {!isRelay && grilledAthleteIds.length > 0 && availableCards.some((c) => c.card_type === "fondue") && (
                <FondueButton raceId={race.id} cardId={availableCards.find((c) => c.card_type === "fondue")!.id} />
              )}

              {isRelay ? (
                <RelayPredictionForm
                  raceId={race.id}
                  nations={nationsWithOdds}
                  initialSelection={initialNationSelection}
                  initialBonusX2={initialBonusX2}
                  x2Eligible={x2Eligible}
                  x2UsesRemaining={x2UsesRemaining}
                />
              ) : (
                <PredictionForm
                  raceId={race.id}
                  athletes={athletesWithOdds}
                  initialSelection={initialAthleteSelection}
                  grilledAthleteIds={grilledAthleteIds}
                  availableCards={availableCards}
                  initialBonusX2={initialBonusX2}
                  initialCardUsed={initialCardUsed}
                  initialCardTarget={initialCardTarget}
                  x2Eligible={x2Eligible}
                  x2UsesRemaining={x2UsesRemaining}
                  startOrder={startOrder}
                />
              )}
            </>
          ))}

        {displayStatus === "ongoing" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                {t("myPredictionTitle")}
              </div>

              {!hasPrediction ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
                  {t("noPredictionMessage")}
                </div>
              ) : isRelay ? (
                <NationPickRow nation={nationsWithOdds.find((n) => n.nation_code === initialNationSelection)} />
              ) : (
                <div className="flex flex-col gap-2">
                  {initialAthleteSelection.map((athleteId) => (
                    <AthletePickRow key={athleteId} athlete={athletesWithOdds.find((a) => a.athlete_id === athleteId)} />
                  ))}
                </div>
              )}

              {initialBonusX2 && (
                <div className="w-fit rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
                  {t("bonusX2Badge")}
                </div>
              )}
            </div>

            {isAdmin && (
              <a
                href={`/admin/races/${race.id}`}
                className="rounded-full bg-ice py-2.5 text-center font-display text-[13px] font-bold text-on-ice"
              >
                {t("adminEnterResultsButton")}
              </a>
            )}
          </div>
        )}

        {displayStatus === "finished" && (
          <div className="flex flex-col gap-4">
            {user && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-card2 to-card p-5">
                <div className="flex items-end justify-between gap-3">
                  <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                    {t("pointsEarnedLabel")}
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ice">{Math.round(pointsEarned * 10) / 10} pts</div>
                </div>

                {/* Rappel du pronostic juste sous les points, pour comprendre d'où ils viennent. */}
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="font-display text-[11px] font-bold uppercase tracking-wider text-text-dim">
                    {t("myPredictionTitle")}
                  </div>
                  {!raceResult?.prediction ? (
                    <div className="text-[13px] text-text-dim">{t("noPredictionMessage")}</div>
                  ) : (
                    <PredictionBreakdown picks={raceResult.prediction.picks} extras={raceResult.prediction.extras} />
                  )}
                  {initialBonusX2 && (
                    <div className="w-fit rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
                      {t("bonusX2Badge")}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                {t("resultsTitle")}
              </div>

              {results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
                  {t("noResultsMessage")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((row) => (
                    <div
                      key={`${row.rank}-${row.name}`}
                      className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3 ${
                        row.mine ? "border-ice/60 bg-ice-soft" : "border-border bg-card"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                          row.rank === 1 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
                        }`}
                      >
                        {row.rank}
                      </div>
                      <div className="text-base">{nationFlagEmoji(row.nationCode)}</div>
                      <div className="flex flex-1 items-center gap-1 truncate text-sm font-semibold">
                        <span className="truncate">{row.name}</span>
                        <FuseeGachetteBadges fusee={row.fusee} gachette={row.gachette} />
                      </div>
                      {row.mine && <CheckIcon className="h-4 w-4 flex-shrink-0 text-ice" />}
                      {row.points != null && (
                        <div className="whitespace-nowrap font-display text-[13px] font-bold text-gold">{formatPoints(row.points)}</div>
                      )}
                    </div>
                  ))}
                  {results.some((r) => r.fusee || r.gachette) && <FuseeGachetteLegend />}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav active="/courses" />
    </div>
  );
}

function AthletePickRow({ athlete }: { athlete: AthleteWithOdds | undefined }) {
  if (!athlete) return null;
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="text-base">{nationFlagEmoji(athlete.nation_code)}</div>
      <div className="flex-1 text-sm font-semibold">
        {athlete.first_name} {athlete.last_name}
      </div>
      <div className="font-display text-sm font-bold text-ice">×{athlete.value}</div>
    </div>
  );
}

function NationPickRow({ nation }: { nation: NationWithOdds | undefined }) {
  if (!nation) return null;
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="text-base">{nationFlagEmoji(nation.nation_code)}</div>
      <div className="flex-1 text-sm font-semibold">{nation.name}</div>
      <div className="font-display text-sm font-bold text-ice">×{nation.value}</div>
    </div>
  );
}
