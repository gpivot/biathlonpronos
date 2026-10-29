import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeaderActions } from "@/components/HeaderActions";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon } from "@/components/icons";
import { getClock } from "@/lib/clock";
import { PronosAccordion, type PronosRace, type PronosStage } from "./PronosAccordion";

export const dynamic = "force-dynamic";

export default async function PronosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const { locale } = await params;
  // Arrivée depuis la carte « En ce moment » de l'accueil : l'étape en cours est dépliée d'office.
  const { etape: initialOpenStageId } = await searchParams;
  const supabase = createClient();
  const t = await getTranslations("Pronos");
  const tNav = await getTranslations("Nav");
  const title = tNav("predictions");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell activeNav="/pronos" title={title}>
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </Shell>
    );
  }

  // Seules les étapes de la saison active sont listées (comme l'accueil) : les étapes de la saison
  // suivante, déjà importées dans le calendrier, n'apparaissent qu'une fois cette saison activée.
  const { data: activeSeason } = await supabase.from("seasons").select("id").eq("status", "active").maybeSingle();
  const inActiveSeason = (stage: { season_id: string } | null) => !activeSeason || stage?.season_id === activeSeason.id;

  const { data: allPredictions } = await supabase
    .from("predictions")
    .select("*, races(*, stages(id, season_id, location, country_code, starts_on, ends_on, coefficient))")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });
  const predictions = (allPredictions ?? []).filter((p: any) => inActiveSeason(p.races?.stages));

  const predictedRaceIds = new Set((predictions ?? []).map((p) => p.race_id));

  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("*, stages(id, season_id, location, country_code, starts_on, ends_on, coefficient)")
    .eq("status", "upcoming")
    .gt("locks_at", (await getClock()).now.toISOString())
    .order("locks_at", { ascending: true });

  const openRaces = (upcomingRaces ?? []).filter(
    (race: any) => !predictedRaceIds.has(race.id) && inActiveSeason(race.stages),
  );

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

  const stagesById = new Map<string, PronosStage>();
  const addRace = (stage: any, race: PronosRace) => {
    if (!stagesById.has(stage.id)) {
      stagesById.set(stage.id, {
        id: stage.id,
        location: stage.location,
        country_code: stage.country_code,
        starts_on: stage.starts_on,
        ends_on: stage.ends_on,
        coefficient: stage.coefficient,
        races: [],
      });
    }
    stagesById.get(stage.id)!.races.push(race);
  };

  for (const race of openRaces as any[]) {
    addRace(race.stages, { id: race.id, format: race.format, sex: race.sex, locks_at: race.locks_at, kind: "open" });
  }
  for (const prediction of (predictions ?? []) as any[]) {
    const race = prediction.races;
    const names = prediction.nation_code
      ? nationNameByCode.get(prediction.nation_code) ?? prediction.nation_code
      : (prediction.athlete_ids ?? []).map((id: string) => athleteNameById.get(id) ?? "?").join(", ");
    addRace(race.stages, {
      id: race.id,
      format: race.format,
      sex: race.sex,
      locks_at: race.locks_at,
      kind: "predicted",
      names,
      bonusX2: prediction.bonus_x2_used,
      points: pointsByRaceId.get(prediction.race_id) ?? null,
    });
  }

  const stages = Array.from(stagesById.values())
    .map((stage) => ({
      ...stage,
      races: stage.races.sort((a, b) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()),
    }))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));


  return (
    <Shell activeNav="/pronos" title={title}>
      <Link
        href="/globes"
        className="rounded-2xl border border-border bg-card px-4 py-3.5 text-center font-display text-sm font-bold text-ice"
      >
        {t("seasonPredictionsLink")}
      </Link>

      {stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("emptyAll")}
        </div>
      ) : (
        <PronosAccordion stages={stages} locale={locale} initialOpenStageId={initialOpenStageId ?? null} />
      )}
    </Shell>
  );
}

function Shell({
  children,
  activeNav,
  title,
}: {
  children: React.ReactNode;
  activeNav: "/pronos";
  title: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-dim"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="font-display text-lg font-bold">{title}</div>
          <HeaderActions />
        </div>
        {children}
      </div>
      <BottomNav active={activeNav} />
    </div>
  );
}
