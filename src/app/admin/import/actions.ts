"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { importAthleteOddsCsv, importMixedRelayOddsCsv, type ImportSummary } from "@/lib/admin/csvImport";

export async function runImport(
  seasonId: string,
  kind: "F" | "H" | "mixte",
  csvText: string
): Promise<ImportSummary> {
  const admin = createAdminClient();

  if (kind === "mixte") return importMixedRelayOddsCsv(admin, seasonId, csvText);
  return importAthleteOddsCsv(admin, seasonId, kind, csvText);
}
