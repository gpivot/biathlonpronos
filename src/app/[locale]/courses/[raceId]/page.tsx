import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ClockIcon } from "@/components/icons";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { PredictionForm, type AthleteWithOdds } from "./PredictionForm";
import { RelayPredictionForm, type NationWithOdds } from "./RelayPredictionForm";
import { FondueButton } from "./FondueButton";

export const dynamic = "force-dynamic";

const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

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
  const displayStatus = getRaceDisplayStatus(race);

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
      const [{ data: existing }, { data: grilled }] = await Promise.all([
        supabase
          .from("predictions")
          .select("athlete_ids, bonus_x2_used, bonus_card_used, bonus_card_target_athlete_id")
          .eq("user_id", user.id)
          .eq("race_id", race.id)
          .maybeSingle(),
        supabase
          .from("grilled_states")
          .select("athlete_id")
          .eq("user_id", user.id)
          .eq("stage_id", stage.id)
          .eq("grilled", true),
      ]);
      initialAthleteSelection = existing?.athlete_ids ?? [];
      grilledAthleteIds = (grilled ?? []).map((g) => g.athlete_id);
      initialBonusX2 = existing?.bonus_x2_used ?? false;
      initialCardUsed = existing?.bonus_card_used ?? null;
      initialCardTarget = existing?.bonus_card_target_athlete_id ?? null;
    }
  }

  const hasOdds = isRelay ? nationsWithOdds.length > 0 : athletesWithOdds.length > 0;
  const hasPrediction = isRelay ? Boolean(initialNationSelection) : initialAthleteSelection.length > 0;

  let results: { rank: number; label: string; flag: string }[] = [];
  let pointsEarned: number | null = null;

  if (displayStatus === "finished") {
    const { data: raceResults } = await supabase
      .from("race_results")
      .select("rank, athlete_id, nation_code, athletes(first_name, last_name, nation_code), nations(name)")
      .eq("race_id", race.id)
      .order("rank", { ascending: true });

    results = (raceResults ?? []).map((r: any) => ({
      rank: r.rank,
      label: r.athlete_id
        ? `${r.athletes?.first_name ?? ""} ${r.athletes?.last_name ?? ""}`
        : r.nations?.name ?? r.nation_code,
      flag: nationFlagEmoji(r.athlete_id ? r.athletes?.nation_code : r.nation_code),
    }));

    if (user) {
      const { data: ledgerEntry } = await supabase
        .from("score_ledger")
        .select("points")
        .eq("user_id", user.id)
        .eq("race_id", race.id)
        .maybeSingle();
      pointsEarned = ledgerEntry?.points ?? 0;
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 pb-3 pt-5">
        <div className="text-center font-display text-[15px] font-bold">
          {tFormat(race.format)}
          {race.sex ? ` ${tSex(race.sex)}` : ""}
        </div>

        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-gradient-to-br from-card2 to-card px-4 py-4">
          <div className="flex items-center gap-2 font-display text-[13px] font-bold text-ice">
            <ClockIcon className="h-4 w-4" />
            {displayStatus === "upcoming"
              ? t("lockLabel", {
                  date: new Date(race.locks_at).toLocaleString(locale, {
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
                <FondueButton stageId={stage.id} cardId={availableCards.find((c) => c.card_type === "fondue")!.id} />
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
                  stageId={stage.id}
                  athletes={athletesWithOdds}
                  initialSelection={initialAthleteSelection}
                  grilledAthleteIds={grilledAthleteIds}
                  availableCards={availableCards}
                  initialBonusX2={initialBonusX2}
                  initialCardUsed={initialCardUsed}
                  initialCardTarget={initialCardTarget}
                  x2Eligible={x2Eligible}
                  x2UsesRemaining={x2UsesRemaining}
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
                className="rounded-full bg-ice py-2.5 text-center font-display text-[13px] font-bold text-[#062024]"
              >
                {t("adminEnterResultsButton")}
              </a>
            )}
          </div>
        )}

        {displayStatus === "finished" && (
          <div className="flex flex-col gap-4">
            {user && (
              <div className="flex flex-col gap-1 rounded-2xl border border-border bg-gradient-to-br from-card2 to-card p-5">
                <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                  {t("pointsEarnedLabel")}
                </div>
                <div className="font-display text-2xl font-extrabold text-ice">{pointsEarned ?? 0} pts</div>
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
                      key={row.rank}
                      className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                          row.rank === 1 ? "bg-gold-soft text-gold" : "bg-ice-soft text-ice"
                        }`}
                      >
                        {row.rank}
                      </div>
                      <div className="text-base">{row.flag}</div>
                      <div className="flex-1 text-sm font-semibold">{row.label}</div>
                    </div>
                  ))}
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
