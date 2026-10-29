import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeaderActions } from "@/components/HeaderActions";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon } from "@/components/icons";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { getClock } from "@/lib/clock";
import { CalendarAccordion, type CalendarStage } from "./CalendarAccordion";
import { CalendarImportButton } from "./CalendarImportButton";
import { SeasonPredictionsAccordion, type SeasonPick } from "./SeasonPredictionsAccordion";

export const dynamic = "force-dynamic";

interface CalendarData {
  seasonId: string | null;
  stages: CalendarStage[];
  isAdmin: boolean;
  /** null : visiteur non connecté. */
  seasonPicks: SeasonPick[] | null;
}

const SEASON_CATEGORIES = [
  "gros_globe_f",
  "gros_globe_h",
  "meilleur_jeune_f",
  "meilleur_jeune_h",
  "meilleure_nation_f",
  "meilleure_nation_h",
] as const;

const shortName = (a: { first_name?: string; last_name?: string } | null | undefined) =>
  a ? `${a.first_name ? `${a.first_name[0]}. ` : ""}${a.last_name ?? ""}` : "?";

async function getCalendarData(): Promise<CalendarData> {
  const supabase = createClient();

  const [{ data: season }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.auth.getUser(),
  ]);

  let isAdmin = false;
  if (userResult.user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userResult.user.id).maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  if (!season) return { seasonId: null, stages: [], isAdmin, seasonPicks: null };

  const { now } = await getClock();

  // Fusion avec l'ancien onglet « Ma saison » : pronostic, bonus ×2 et points de chaque course.
  const user = userResult.user;
  const [{ data: predictions }, { data: ledger }, { data: seasonPredictions }, { data: pepites }] = await Promise.all([
    user
      ? supabase.from("predictions").select("race_id, athlete_ids, nation_code, bonus_x2_used").eq("user_id", user.id)
      : Promise.resolve({ data: [] as any[] }),
    user
      ? supabase.from("score_ledger").select("race_id, points").eq("user_id", user.id).eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
    user
      ? supabase
          .from("season_predictions")
          .select("category, athlete_id, nation_code")
          .eq("user_id", user.id)
          .eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
    user
      ? supabase.from("pepites").select("sex, athlete_id").eq("user_id", user.id).eq("season_id", season.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const predictionByRaceId = new Map((predictions ?? []).map((p: any) => [p.race_id as string, p]));
  const pointsByRaceId = new Map((ledger ?? []).map((l: any) => [l.race_id as string, Number(l.points)]));

  const athleteIds = Array.from(
    new Set([
      ...(predictions ?? []).flatMap((p: any) => p.athlete_ids ?? []),
      ...(seasonPredictions ?? []).map((p: any) => p.athlete_id).filter(Boolean),
      ...(pepites ?? []).map((p: any) => p.athlete_id),
    ])
  );
  const nationCodes = Array.from(
    new Set([
      ...(predictions ?? []).map((p: any) => p.nation_code),
      ...(seasonPredictions ?? []).map((p: any) => p.nation_code),
    ].filter(Boolean))
  );
  const [{ data: athletes }, { data: nations }] = await Promise.all([
    athleteIds.length
      ? supabase.from("athletes").select("id, first_name, last_name, nation_code").in("id", athleteIds)
      : Promise.resolve({ data: [] as any[] }),
    nationCodes.length ? supabase.from("nations").select("code, name").in("code", nationCodes) : Promise.resolve({ data: [] as any[] }),
  ]);
  const athleteById = new Map((athletes ?? []).map((a: any) => [a.id as string, a]));
  const nationNameByCode = new Map((nations ?? []).map((n: any) => [n.code as string, n.name as string]));
  const pickNames = (p: any): string =>
    p.nation_code
      ? nationNameByCode.get(p.nation_code) ?? p.nation_code
      : (p.athlete_ids ?? []).map((id: string) => shortName(athleteById.get(id))).join(", ");

  const seasonPickByCategory = new Map((seasonPredictions ?? []).map((p: any) => [p.category as string, p]));
  const seasonPicks: SeasonPick[] | null = user
    ? [
        ...SEASON_CATEGORIES.map((category) => {
          const pick = seasonPickByCategory.get(category);
          const athlete = pick?.athlete_id ? athleteById.get(pick.athlete_id) : null;
          return {
            key: category,
            labelKey: `category_${category}`,
            name: pick ? (athlete ? shortName(athlete) : nationNameByCode.get(pick.nation_code) ?? pick.nation_code) : null,
            nationCode: athlete?.nation_code ?? pick?.nation_code ?? null,
          };
        }),
        ...(["F", "H"] as const).map((sex) => {
          const pepite = (pepites ?? []).find((p: any) => p.sex === sex);
          const athlete = pepite ? athleteById.get(pepite.athlete_id) : null;
          return {
            key: `pepite_${sex}`,
            labelKey: `pepite_${sex}`,
            name: athlete ? shortName(athlete) : null,
            nationCode: athlete?.nation_code ?? null,
          };
        }),
      ]
    : null;

  const { data: stages, error } = await supabase
    .from("stages")
    .select("id, location, country_code, starts_on, ends_on, coefficient, races(id, format, sex, locks_at, status)")
    .eq("season_id", season.id)
    .order("starts_on", { ascending: true });

  if (error) {
    console.error("getCalendarData:", error.message);
    return { seasonId: season.id, stages: [], isAdmin, seasonPicks };
  }

  const mapped: CalendarStage[] = (stages ?? []).map((stage: any) => ({
    id: stage.id,
    location: stage.location,
    country_code: stage.country_code,
    starts_on: stage.starts_on,
    ends_on: stage.ends_on,
    coefficient: stage.coefficient,
    races: (stage.races ?? [])
      .map((race: any) => ({
        ...race,
        displayStatus: getRaceDisplayStatus(race, now),
        predicted: predictionByRaceId.has(race.id),
        names: predictionByRaceId.has(race.id) ? pickNames(predictionByRaceId.get(race.id)) : null,
        bonusX2: predictionByRaceId.get(race.id)?.bonus_x2_used ?? false,
        points: pointsByRaceId.get(race.id) ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()),
  }));

  return { seasonId: season.id, stages: mapped, isAdmin, seasonPicks };
}

/** Étape "courante" par défaut : la première qui n'est pas entièrement terminée. */
function pickDefaultOpenStageId(stages: CalendarStage[]): string | null {
  const current = stages.find((stage) => stage.races.some((r) => r.displayStatus !== "finished"));
  return current?.id ?? stages[0]?.id ?? null;
}

export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const { locale } = await params;
  // Arrivée depuis « L'étape de la semaine » de l'accueil : cette étape est dépliée d'office.
  const { etape } = await searchParams;
  const t = await getTranslations("Courses");
  const { seasonId, stages, isAdmin, seasonPicks } = await getCalendarData();
  const requestedStageId = etape && stages.some((s) => s.id === etape) ? etape : null;

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

        {isAdmin && seasonId && <CalendarImportButton seasonId={seasonId} />}

        {seasonPicks && <SeasonPredictionsAccordion picks={seasonPicks} />}

        {stages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyState")}
          </div>
        ) : (
          <CalendarAccordion
            stages={stages}
            defaultOpenStageId={requestedStageId ?? pickDefaultOpenStageId(stages)}
            scrollToStageId={requestedStageId}
            locale={locale}
          />
        )}
      </div>

      <BottomNav active="/courses" />
    </div>
  );
}
