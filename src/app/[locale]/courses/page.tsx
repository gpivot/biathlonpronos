import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon } from "@/components/icons";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { CalendarAccordion, type CalendarStage } from "./CalendarAccordion";
import { CalendarImportButton } from "./CalendarImportButton";

export const dynamic = "force-dynamic";

interface CalendarData {
  seasonId: string | null;
  stages: CalendarStage[];
  isAdmin: boolean;
}

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

  if (!season) return { seasonId: null, stages: [], isAdmin };

  const { data: stages, error } = await supabase
    .from("stages")
    .select("id, location, country_code, starts_on, ends_on, coefficient, races(id, format, sex, locks_at, status)")
    .eq("season_id", season.id)
    .order("starts_on", { ascending: true });

  if (error) {
    console.error("getCalendarData:", error.message);
    return { seasonId: season.id, stages: [], isAdmin };
  }

  const mapped: CalendarStage[] = (stages ?? []).map((stage: any) => ({
    id: stage.id,
    location: stage.location,
    country_code: stage.country_code,
    starts_on: stage.starts_on,
    ends_on: stage.ends_on,
    coefficient: stage.coefficient,
    races: (stage.races ?? [])
      .map((race: any) => ({ ...race, displayStatus: getRaceDisplayStatus(race) }))
      .sort((a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()),
  }));

  return { seasonId: season.id, stages: mapped, isAdmin };
}

/** Étape "courante" par défaut : la première qui n'est pas entièrement terminée. */
function pickDefaultOpenStageId(stages: CalendarStage[]): string | null {
  const current = stages.find((stage) => stage.races.some((r) => r.displayStatus !== "finished"));
  return current?.id ?? stages[0]?.id ?? null;
}

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Courses");
  const { seasonId, stages, isAdmin } = await getCalendarData();

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
        </div>

        {isAdmin && seasonId && <CalendarImportButton seasonId={seasonId} />}

        {stages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("emptyState")}
          </div>
        ) : (
          <CalendarAccordion stages={stages} defaultOpenStageId={pickDefaultOpenStageId(stages)} locale={locale} />
        )}
      </div>

      <BottomNav active="/courses" />
    </div>
  );
}
