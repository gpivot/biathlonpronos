"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { importCalendarCsv, type CalendarImportSummary } from "@/lib/admin/calendarImport";

/**
 * Réservé aux admins. Le bouton d'import n'est visible que pour eux côté UI
 * (`/courses`, hors périmètre `/admin`), mais une Server Action reste un
 * point d'entrée public — on revérifie donc `is_admin` ici avant d'écrire.
 */
export async function runCalendarImport(seasonId: string, csvText: string): Promise<CalendarImportSummary> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) throw new Error("Réservé aux administrateurs.");

  const admin = createAdminClient();
  return importCalendarCsv(admin, seasonId, csvText);
}
