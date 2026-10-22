import { createAdminClient } from "@/lib/supabase/server";
import { buildOddsCsv } from "@/lib/admin/oddsCsv";
import { fetchAll } from "@/lib/admin/fetchAll";
import { adminCsvResponse } from "../../_components/csvResponse";

export const dynamic = "force-dynamic";

export function GET() {
  return adminCsvResponse(async () => {
    const admin = createAdminClient();
    const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();
    if (!season) return { filename: "cotes.csv", csv: buildOddsCsv({ nations: [], athletes: [], odds: [] }) };

    const [{ data: nations }, { data: athletes }, odds] = await Promise.all([
      admin.from("nations").select("code, name"),
      admin.from("athletes").select("id, first_name, last_name, nation_code, sex").eq("season_id", season.id),
      fetchAll((from, to) =>
        admin
          .from("odds")
          .select("format, value, athlete_id, nation_code, nation_sex")
          .eq("season_id", season.id)
          .is("valid_until", null)
          .order("id")
          .range(from, to)
      ),
    ]);
    return {
      filename: `cotes-${season.label}.csv`,
      csv: buildOddsCsv({ nations: nations ?? [], athletes: athletes ?? [], odds }),
    };
  });
}
