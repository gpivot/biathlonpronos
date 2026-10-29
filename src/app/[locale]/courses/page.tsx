import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeaderActions } from "@/components/HeaderActions";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon } from "@/components/icons";
import { getSeasonView, pickDefaultOpenStageId } from "@/lib/seasonView";
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

async function getCalendarData(): Promise<CalendarData> {
  const supabase = createClient();

  const [{ data: season }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id, starts_on").eq("status", "active").maybeSingle(),
    supabase.auth.getUser(),
  ]);

  let isAdmin = false;
  if (userResult.user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userResult.user.id).maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  if (!season) return { seasonId: null, stages: [], isAdmin, seasonPicks: null };

  const { now } = await getClock();
  const { stages, seasonPicks } = await getSeasonView(supabase, season, userResult.user?.id ?? null, now);
  return { seasonId: season.id, stages, isAdmin, seasonPicks };
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
