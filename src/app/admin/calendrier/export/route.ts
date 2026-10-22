import { createAdminClient } from "@/lib/supabase/server";
import { buildCalendarCsv } from "@/lib/admin/calendarImport";
import { adminCsvResponse } from "../../_components/csvResponse";

export const dynamic = "force-dynamic";

export function GET() {
  return adminCsvResponse(async () => {
    const admin = createAdminClient();
    const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();
    if (!season) return { filename: "calendrier.csv", csv: buildCalendarCsv([]) };

    const { data: stages } = await admin
      .from("stages")
      .select("location, country_code, coefficient, races(format, sex, locks_at)")
      .eq("season_id", season.id);
    return { filename: `calendrier-${season.label}.csv`, csv: buildCalendarCsv(stages ?? []) };
  });
}
