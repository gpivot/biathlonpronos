"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StreakCard } from "@/components/StreakCard";
import { BonusCardsList } from "@/components/BonusCardsList";
import { PlayerBadgesRow } from "@/components/PlayerBadgesRow";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import { CalendarAccordion } from "../courses/CalendarAccordion";
import { SeasonPredictionsAccordion } from "../courses/SeasonPredictionsAccordion";
import { getPlayerRaceDetails, getPlayerSeason, type PlayerRaceDetail, type PlayerSeason } from "./actions";
import { PlayerRaceBars } from "./PlayerRaceBars";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { displayedSex } from "@/lib/raceLabel";
import type { CalendarRace, CalendarStage } from "../courses/CalendarAccordion";

/** Courses détaillées par paquets (chacune demande plusieurs lectures ; l'action en accepte 20). */
const DETAIL_BATCH = 20;

/** Classement « Par étapes » : le pop-up se limite à cette étape (demande de Guillaume, 04/11/2026). */
export interface PlayerStageScope {
  stageId: string;
  rank: number;
  points: number;
  /** En tête de l'étape : dossard rouge. */
  leader: boolean;
  /** Classement d'une seule course de l'étape (rang et points de cette course). */
  singleRace: boolean;
  /** Cette course (classement d'une seule course) : la fiche ne montre qu'elle. */
  raceId?: string | null;
}

/**
 * Ligne du Classement cliquable : ouvre un pop-up avec la page « Ma saison » du joueur
 * (pronostics de saison repliés, puis ses pronostics d'étapes), en lecture seule.
 * Avec `stage` (classement par étapes), seuls ses pronostics, ses points et sa place sur
 * cette étape sont montrés.
 */
export function PlayerSeasonButton({
  userId,
  className,
  children,
  stage = null,
}: {
  userId: string;
  className: string;
  children: ReactNode;
  stage?: PlayerStageScope | null;
}) {
  const t = useTranslations("Classement");
  const tHome = useTranslations("Home");
  const tSex = useTranslations("Sex");
  const tCards = useTranslations("BonusCards");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PlayerSeason | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  // Détail des courses terminées (points par biathlète, Pépite) : absent tant que pas chargé.
  const [details, setDetails] = useState<Record<string, PlayerRaceDetail | null>>({});
  // Classement Saison : détail chargé quand la course apparaît à l'écran, regroupé en un appel.
  const pendingRef = useRef<Set<string>>(new Set());
  const requestedRef = useRef<Set<string>>(new Set());
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Étapes hors classement (« Autre (×0) », ex. pré-saison à Geilo) : sans intérêt dans la fiche d'un joueur.
  const rankedStages = data?.stages.filter((s) => s.counts_in_standings !== false) ?? [];
  // Classement Saison : toutes les courses de la saison, dans l'ordre du calendrier (Guillaume, 26/11/2026).
  const seasonRaces = rankedStages.flatMap((s) => s.races.map((race) => ({ race, stage: s })));

  const loadDetails = async (ids: string[]) => {
    const raceIds = ids.filter((id) => !requestedRef.current.has(id));
    if (raceIds.length === 0) return;
    raceIds.forEach((id) => requestedRef.current.add(id));
    setDetails((prev) => ({ ...prev, ...Object.fromEntries(raceIds.map((id) => [id, prev[id] ?? null])) }));
    try {
      const batches = Array.from({ length: Math.ceil(raceIds.length / DETAIL_BATCH) }, (_, i) =>
        raceIds.slice(i * DETAIL_BATCH, (i + 1) * DETAIL_BATCH)
      );
      const loaded = await Promise.all(batches.map((batch) => getPlayerRaceDetails(userId, batch)));
      setDetails((prev) => Object.assign({ ...prev }, ...loaded));
    } catch {
      // Sans détail, la course garde son total.
    }
  };

  const requestDetail = (raceId: string) => {
    pendingRef.current.add(raceId);
    if (flushRef.current) return;
    flushRef.current = setTimeout(() => {
      flushRef.current = null;
      const ids = Array.from(pendingRef.current);
      pendingRef.current.clear();
      void loadDetails(ids);
    }, 150);
  };

  const show = async () => {
    setOpen(true);
    if (data) return;
    setState("loading");
    try {
      const result = await getPlayerSeason(userId);
      setData(result);
      setState(result ? "idle" : "error");
      // Filtre par étape : détail de ses courses terminées tout de suite (en Saison, à l'affichage de chaque course).
      if (result && stage) {
        void loadDetails(
          (result.stages.find((s) => s.id === stage.stageId)?.races ?? [])
            .filter((r) => r.displayStatus === "finished" && (!stage.raceId || r.id === stage.raceId))
            .map((r) => r.id)
        );
      }
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <button type="button" onClick={show} className={`w-full text-left ${className}`}>
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={data?.pseudo ?? t("playerTitle")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-t-2xl border border-border bg-bg p-4 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate font-display text-base font-bold">{data?.pseudo ?? t("playerTitle")}</div>
                {data &&
                  (stage ? (
                    stage.leader && <PlayerBadgesRow badges={undefined} stageLeader />
                  ) : (
                    <PlayerBadgesRow badges={data.badges} leader={data.leader} />
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-dim"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* [&>*]:shrink-0 : sans ça, les encadrés « overflow-hidden » (pronostics de saison) s'écrasent à 0 px quand la liste déborde. */}
            <div className="flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
              {state === "loading" && <div className="py-6 text-center text-[13px] text-text-dim">{t("playerLoading")}</div>}
              {state === "error" && <div className="py-6 text-center text-[13px] text-text-dim">{t("playerError")}</div>}
              {data && stage && (
                <>
                  <div className="flex items-end justify-between rounded-2xl border border-border bg-gradient-to-br from-card2 to-card p-4">
                    <div>
                      <div className="font-display text-xl font-extrabold text-frost">#{stage.rank}</div>
                      <div className="text-xs text-text-dim">{t(stage.singleRace ? "playerRaceRankLabel" : "playerStageRankLabel")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl font-extrabold text-ice">{Math.round(stage.points * 10) / 10} pts</div>
                      <div className="text-xs text-text-dim">{tHome("pointsLabel")}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-dim">{t("playerHiddenHint")}</div>
                  <CalendarAccordion
                    // Classement d'une course : la fiche ne montre qu'elle.
                    stages={data.stages
                      .filter((s) => s.id === stage.stageId)
                      .map((s) => (stage.raceId ? { ...s, races: s.races.filter((r) => r.id === stage.raceId) } : s))}
                    defaultOpenStageId={stage.stageId}
                    locale={locale}
                    readOnly
                    renderRaceDetail={(raceId) => <RaceDetail detail={details[raceId]} loaded={raceId in details} />}
                  />
                </>
              )}
              {data && !stage && (
                <>
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-gradient-to-br from-card2 to-card p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="font-display text-xl font-extrabold text-frost">{data.rank ? `#${data.rank}` : "–"}</div>
                        <div className="text-xs text-text-dim">{tHome("rankLabel")}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-xl font-extrabold text-ice">{Math.round(data.points * 10) / 10} pts</div>
                        <div className="text-xs text-text-dim">{tHome("pointsLabel")}</div>
                      </div>
                    </div>
                    {data.cards && data.cards.cards.length > 0 && (
                      <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
                        <div className="font-display text-[11px] font-bold uppercase tracking-wider text-text-dim">
                          🃏 {tCards("title")}
                        </div>
                        <BonusCardsList cards={data.cards.cards} compact />
                      </div>
                    )}
                  </div>
                  {data.seasonPicks && (
                    <SeasonPredictionsAccordion
                      picks={data.seasonPicks}
                      readOnly
                      // Pépites cachées : seulement celles déjà révélées (les autres ne quittent jamais le serveur).
                      revealedPepites={(data.pepites ?? []).flatMap((p) =>
                        p.revealed && p.name ? [{ sex: p.sex, name: p.name, nationCode: p.nationCode }] : []
                      )}
                      favoriteTeam={
                        data.favoriteTeam
                          ? { label: `${data.favoriteTeam.name} ${tSex(data.favoriteTeam.sex)}`, nationCode: data.favoriteTeam.nationCode }
                          : undefined
                      }
                      hiddenNote={
                        data.seasonPicksHiddenUntil === undefined
                          ? null
                          : data.seasonPicksHiddenUntil
                            ? t("playerSeasonPicksHidden", {
                                date: new Intl.DateTimeFormat(locale, {
                                  timeZone: DISPLAY_TIME_ZONE,
                                  day: "numeric",
                                  month: "long",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(data.seasonPicksHiddenUntil)),
                              })
                            : t("playerSeasonPicksHiddenNoDate")
                      }
                    />
                  )}
                  {data.streak != null && <StreakCard current={data.streak} />}
                  <div className="text-[11px] text-text-dim">{t("playerHiddenHint")}</div>
                  <div className="flex flex-col gap-2">
                    {seasonRaces.map(({ race, stage: raceStage }) => (
                      <SeasonRaceCard
                        key={race.id}
                        race={race}
                        stage={raceStage}
                        locale={locale}
                        onVisible={requestDetail}
                        detail={<RaceDetail detail={details[race.id]} loaded={race.id in details} />}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RaceDetail({ detail, loaded }: { detail: PlayerRaceDetail | null | undefined; loaded: boolean }) {
  const t = useTranslations("Classement");
  if (detail) return <PlayerRaceBars detail={detail} />;
  if (loaded && detail === null) return <div className="text-[11px] text-text-dim">{t("playerLoading")}</div>;
  return null;
}

/** Classement Saison : une course de la saison, avec son étape ; terminée, son total et son détail. */
function SeasonRaceCard({
  race,
  stage,
  locale,
  detail,
  onVisible,
}: {
  race: CalendarRace;
  stage: CalendarStage;
  locale: string;
  detail: ReactNode;
  onVisible: (raceId: string) => void;
}) {
  const tFormat = useTranslations("RaceFormat");
  const tSex = useTranslations("Sex");
  const tRace = useTranslations("Race");
  const sex = displayedSex(race);
  const finished = race.displayStatus === "finished";
  const ref = useRef<HTMLAnchorElement | null>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  useEffect(() => {
    const element = ref.current;
    if (!finished || !element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onVisibleRef.current(race.id);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [finished, race.id]);
  return (
    <Link
      ref={ref}
      href={`/courses/${race.id}`}
      className={`flex flex-col gap-2.5 rounded-xl border bg-card px-3.5 py-3 ${stage.coefficient === 2 ? "border-gold/60" : "border-border"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className={`truncate font-display text-[10px] font-bold uppercase tracking-wider ${stage.coefficient === 2 ? "text-gold" : "text-ice"}`}>
            {nationFlagEmoji(stage.country_code)} {stage.location} ·{" "}
            {new Date(race.locks_at).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" })}
            {!finished &&
              ` · ${new Date(race.locks_at).toLocaleTimeString(locale, { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`}
          </div>
          <div className="text-sm font-semibold">
            {tFormat(race.format)}
            {sex ? ` ${tSex(sex)}` : ""}
          </div>
        </div>
        {!finished && (
          <div
            className={`whitespace-nowrap rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${
              race.displayStatus === "ongoing" ? "bg-gold-soft text-gold" : "border border-border text-text-dim"
            }`}
          >
            {tRace(`status_${race.displayStatus}`)}
          </div>
        )}
        {finished && race.points == null && (
          <div className="whitespace-nowrap rounded-full bg-ice-soft px-2.5 py-1 font-display text-[11px] font-bold text-ice">
            {tRace("status_finished")}
          </div>
        )}
        {finished && race.points != null && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <div className="whitespace-nowrap font-display text-lg font-extrabold text-gold">
              {race.points > 0 ? "+" : ""}
              {Math.round(race.points * 10) / 10} pts
            </div>
            <ChevronDownIcon className="h-3.5 w-3.5 -rotate-90 text-text-dim" />
          </div>
        )}
      </div>
      {finished && detail}
    </Link>
  );
}
