import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { getClock } from "@/lib/clock";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { PredictionForm, type AthleteWithOdds } from "./PredictionForm";
import { RelayPredictionForm, type NationWithOdds } from "./RelayPredictionForm";
import { FondueButton } from "./FondueButton";
import { RuleInfoButton } from "./RuleInfoButton";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { displayedSex } from "@/lib/raceLabel";
import { RELAY_FORMATS, previousRaceForGrilling } from "@/lib/grilling";
import { getRaceResult } from "@/lib/lastResult";
import { getStartList } from "@/lib/startList";
import { isPredictionOpen, predictionOpensOn } from "@/lib/predictionWindow";
import { getOngoingBoard, getRacePlayers } from "@/lib/racePlayers";
import { BackButton } from "@/components/BackButton";
import { OngoingBoardRowView, PlayerRow, ResultRow } from "./RaceRankingRows";
import { ShowMore } from "@/components/ShowMore";
import { MALUS_SCALE, SPECIAL_RULE_ICONS } from "@/lib/specialRules";
import { canPlayCard, cardsOnRace, getSeasonCardRaces, type CardRow } from "@/lib/bonusCards";
import { PredictionBreakdown, formatPoints } from "@/components/PredictionBreakdown";
import { HelpButton } from "@/components/HelpButton";

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
  const tClassement = await getTranslations("Classement");

  const { data: race } = await supabase.from("races").select("*, stages(*)").eq("id", raceId).single();

  if (!race) notFound();

  const stage = race.stages as {
    id: string;
    location: string;
    country_code: string;
    season_id: string;
    coefficient: 1 | 2;
    starts_on: string;
  };
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
  // Cartes jouables sur cette course (une seule à la fois) et carte déjà jouée qui la couvre.
  let playableCards: { id: string; card_type: string }[] = [];
  let activeCard: "ca_farte" | "balle_de_pioche" | null = null;
  let initialBonusX2 = false;
  let initialCardTarget: string | null = null;

  // §7 — bonus ×2 personnel : 3 fois par saison, jamais sur une course
  // spéciale ni sur une étape Mondiaux/JO (déjà comptée double).
  const x2Eligible = !race.special_rule && stage.coefficient !== 2;
  let x2UsesRemaining = 0;

  if (user) {
    const [{ data: cards }, { count: x2UsedCount }, seasonRaces] = await Promise.all([
      supabase
        .from("bonus_cards")
        .select("id, card_type, status, used_on_race_id")
        .eq("user_id", user.id)
        .eq("season_id", stage.season_id),
      supabase
        .from("predictions")
        .select("id, races!inner(stages!inner(season_id))", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("bonus_x2_used", true)
        .eq("races.stages.season_id", stage.season_id),
      getSeasonCardRaces(supabase, stage.season_id),
    ]);
    const cardRows = (cards ?? []) as CardRow[];
    availableCards = cardRows.filter((c) => c.status === "available");
    const onRace = cardsOnRace(race.id, cardRows, seasonRaces);
    activeCard = onRace.caFarte ? "ca_farte" : onRace.quatriemeChoix ? "balle_de_pioche" : null;
    // Le 4e choix s'active tout seul quand il est choisi (0023) : seul Ça farte se joue ici.
    playableCards = availableCards.filter((c) => c.card_type === "ca_farte" && canPlayCard("ca_farte", race.id, cardRows, seasonRaces));
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
      initialCardTarget = existing?.bonus_card_target_athlete_id ?? null;
    }
  }

  // Poursuite / mass start : seuls les qualifiés prennent le départ, dans l'ordre de la liste.
  const startList = displayStatus === "upcoming" ? await getStartList(supabase, race) : { status: "open" as const };
  const startOrder: Record<string, number> = startList.status === "known" ? startList.order : {};
  const startGaps: Record<string, number> = startList.status === "known" ? startList.gaps : {};
  const startListPending = startList.status === "pending";
  // Filtre seulement la liste du formulaire : l'affichage « en cours » garde toutes les cotes.
  const selectableAthletes =
    startList.status === "known" ? athletesWithOdds.filter((a) => startOrder[a.athlete_id] != null) : athletesWithOdds;

  const hasOdds = isRelay ? nationsWithOdds.length > 0 : athletesWithOdds.length > 0;
  // Liste des biathlètes visible 7 jours avant l'étape seulement (cotes mises à jour pendant les pauses).
  const predictionsOpen = isPredictionOpen(stage.starts_on, now);
  const showForm = displayStatus === "upcoming" && hasOdds && !startListPending && predictionsOpen;
  const hasPrediction = isRelay ? Boolean(initialNationSelection) : initialAthleteSelection.length > 0;

  // Course notée : pronostic détaillé (place et points par choix) et classement avec les points du barème.
  const raceResult = displayStatus === "finished" ? await getRaceResult(supabase, race.id, user?.id ?? null) : null;
  const results = raceResult?.results ?? [];
  const pointsEarned = raceResult?.prediction?.points ?? 0;
  const multiplier = raceResult?.prediction?.multiplier ?? null;
  const players = displayStatus === "finished" ? await getRacePlayers(supabase, race.id) : [];
  const ongoingBoard = displayStatus === "ongoing" ? await getOngoingBoard(supabase, stage.season_id, race.id) : [];

  // Courses précédente et suivante de la saison (ordre chronologique), boutons de l'en-tête.
  const { data: seasonRaces } = await supabase
    .from("races")
    .select("id, locks_at, stages!inner(season_id)")
    .eq("stages.season_id", stage.season_id)
    .order("locks_at", { ascending: true });
  const raceIndex = (seasonRaces ?? []).findIndex((r: any) => r.id === race.id);
  const previousRaceId = raceIndex > 0 ? seasonRaces![raceIndex - 1].id : null;
  const nextRaceId = raceIndex >= 0 && raceIndex < (seasonRaces ?? []).length - 1 ? seasonRaces![raceIndex + 1].id : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/courses" label={t("backToCalendar")} />
          {/* Le nom de la course est dans l'encadré ci-dessous ; au milieu, navigation entre les courses. */}
          <div className="flex flex-1 justify-center gap-2">
            <RaceNavLink raceId={previousRaceId} label={t("previousRace")} direction="previous" />
            <RaceNavLink raceId={nextRaceId} label={t("nextRace")} direction="next" />
          </div>
          {/* Avec un formulaire, le « ? » est à côté de « Choisis… » ; sinon il reste ici. */}
          {showForm ? <div className="h-8 w-8 flex-shrink-0" /> : <RuleInfoButton format={race.format} />}
        </div>

        {/* Course malus : contour rouge autour de l'encadré, avec le nom du malus et son « ? ». */}
        <div
          className={`flex flex-col gap-3 rounded-[18px] border px-4 py-4 ${
            race.special_rule ? "border-red/70 bg-gradient-to-br from-red/15 to-card" : "border-border bg-gradient-to-br from-card2 to-card"
          }`}
        >
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
          <div className="flex items-center gap-2 font-display text-base font-bold">
            <span>{nationFlagEmoji(stage.country_code)}</span>
            <span>{stage.location}</span>
          </div>
          <div className="text-sm font-semibold text-frost">
            {tFormat(race.format)}
            {displayedSex(race) ? ` ${tSex(displayedSex(race)!)}` : ""}
          </div>
          {race.special_rule && (
            // Course malus : bandeau rouge avec gros picto, nom du malus, phrase choc et « ? » illustré.
            <div className="flex items-center gap-3 rounded-2xl border border-red/40 bg-red/10 px-3 py-2.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red/20 text-xl">
                {SPECIAL_RULE_ICONS[race.special_rule] ?? "⚠️"}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="font-display text-[11px] font-bold uppercase tracking-wider text-red">
                  {t("malusLabel")} · {tFormat(`specialRule_${race.special_rule}`)}
                </div>
                <div className="text-[13px] font-semibold leading-snug text-frost">{t(`malusTagline_${race.special_rule}`)}</div>
              </div>
              <HelpButton
                title={`${SPECIAL_RULE_ICONS[race.special_rule] ?? "⚠️"} ${tFormat(`specialRule_${race.special_rule}`)}`}
                openLabel={t("specialRulePrefix")}
                closeLabel={tClassement("close")}
                items={(MALUS_SCALE[race.special_rule] ?? []).map((icon, i) => ({
                  icon,
                  text: t(`malusScale_${race.special_rule}_${i + 1}`),
                }))}
              />
            </div>
          )}
          {displayStatus !== "upcoming" && (
            <div className="text-xs text-text-dim first-letter:uppercase">
              {new Date(race.locks_at).toLocaleString(locale, {
                timeZone: DISPLAY_TIME_ZONE,
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {displayStatus === "upcoming" &&
          (!predictionsOpen ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] leading-relaxed text-text-dim">
              {t("predictionsOpenOn", {
                date: new Date(`${predictionOpensOn(stage.starts_on)}T12:00:00Z`).toLocaleDateString(locale, {
                  timeZone: DISPLAY_TIME_ZONE,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              })}
            </div>
          ) : !hasOdds ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
              {t("noOddsMessage", { format: race.format })}
            </div>
          ) : startListPending ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] leading-relaxed text-text-dim">
              {t(race.format === "poursuite" ? "startListPendingPursuit" : "startListPendingMassStart")}
            </div>
          ) : (
            <>
              {!isRelay && grilledAthleteIds.length > 0 && availableCards.some((c) => c.card_type === "fondue") && (
                <FondueButton raceId={race.id} cardId={availableCards.find((c) => c.card_type === "fondue")!.id} />
              )}

              {isRelay ? (
                <RelayPredictionForm
                  raceId={race.id}
                  format={race.format}
                  nations={nationsWithOdds}
                  initialSelection={initialNationSelection}
                  initialBonusX2={initialBonusX2}
                  x2Eligible={x2Eligible}
                  x2UsesRemaining={x2UsesRemaining}
                />
              ) : (
                <PredictionForm
                  raceId={race.id}
                  format={race.format}
                  athletes={selectableAthletes}
                  initialSelection={initialAthleteSelection}
                  grilledAthleteIds={grilledAthleteIds}
                  playableCards={playableCards}
                  activeCard={activeCard}
                  initialBonusX2={initialBonusX2}
                  initialCardTarget={initialCardTarget}
                  x2Eligible={x2Eligible}
                  x2UsesRemaining={x2UsesRemaining}
                  // Mass start : pas d'écart de départ, tri par cote seulement (la liste ne sert qu'à filtrer).
                  startOrder={race.format === "poursuite" ? startOrder : {}}
                  startGaps={startGaps}
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
                  ⚡ {t("bonusX2Badge")}
                </div>
              )}
            </div>

            {ongoingBoard.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("ongoingBoardTitle")}</div>
                {ongoingBoard.map((row) => (
                  <OngoingBoardRowView key={row.userId} row={row} mine={row.userId === user?.id} noPredictionLabel={t("ongoingNoPrediction")} />
                ))}
              </div>
            )}

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
                  <div className="flex flex-col gap-1.5">
                    <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                      {t("pointsEarnedLabel")}
                    </div>
                    {/* Le ×2 (bonus perso ou coefficient Mondiaux/JO) est affiché ici, pas sur chaque ligne. */}
                    {multiplier && (
                      <div className="w-fit rounded-full bg-gold-soft px-2.5 py-1 font-display text-[11px] font-bold text-gold">
                        {multiplier.kind === "bonusX2" && "⚡ "}
                        {t(multiplier.kind === "bonusX2" ? "bonusX2Gain" : "coefficientGain", { points: formatPoints(multiplier.gain) })}
                      </div>
                    )}
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
                    <PredictionBreakdown picks={raceResult.prediction.picks} extras={raceResult.prediction.extras} showLegend={false} showCalc />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Légende des pictos (Fusée, Gâchette, Prono parfait) dans un « ? » plutôt qu'en toutes lettres. */}
              <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-text-dim">
                {t("resultsTitle")}
                <HelpButton
                  title={t("resultsHelpTitle")}
                  openLabel={t("resultsHelpTitle")}
                  closeLabel={tClassement("close")}
                  items={[
                    { icon: "🚀", text: t("resultsHelpFusee") },
                    { icon: "🎯", text: t("resultsHelpGachette") },
                    { icon: "⭐", text: t("resultsHelpPerfect") },
                    { icon: "✓", text: t("resultsHelpMine") },
                  ]}
                />
              </div>

              {results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
                  {t("noResultsMessage")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Top 10 + les choix du joueur classés plus loin ; le reste dans le déroulant. */}
                  {results.length > 10 ? (
                    <ShowMore
                      label={t("showFullRanking")}
                      collapsed={results.filter((r) => r.rank <= 10 || r.mine).map((row) => <ResultRow key={`${row.rank}-${row.name}`} row={row} />)}
                      expanded={results.map((row) => <ResultRow key={`${row.rank}-${row.name}`} row={row} />)}
                    />
                  ) : (
                    results.map((row) => <ResultRow key={`${row.rank}-${row.name}`} row={row} />)
                  )}
                </div>
              )}
            </div>

            {players.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("playersTitle")}</div>
                {players.length > 10 ? (
                  <ShowMore
                    label={t("showFullRanking")}
                    collapsed={players
                      .filter((p, i) => i < 10 || p.userId === user?.id)
                      .map((p) => <PlayerRow key={p.userId} player={p} mine={p.userId === user?.id} raceId={race.id} />)}
                    expanded={players.map((p) => <PlayerRow key={p.userId} player={p} mine={p.userId === user?.id} raceId={race.id} />)}
                  />
                ) : (
                  players.map((p) => <PlayerRow key={p.userId} player={p} mine={p.userId === user?.id} raceId={race.id} />)
                )}
              </div>
            )}
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


function RaceNavLink({ raceId, label, direction }: { raceId: string | null; label: string; direction: "previous" | "next" }) {
  const className =
    "flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-display text-[11px] font-bold";
  const content =
    direction === "previous" ? (
      <>
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        {label}
      </>
    ) : (
      <>
        {label}
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </>
    );
  if (!raceId) return <span className={`${className} text-text-dim opacity-40`}>{content}</span>;
  return (
    <Link href={`/courses/${raceId}`} className={`${className} text-ice`}>
      {content}
    </Link>
  );
}
