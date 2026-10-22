"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { clearCurrentOdds, setCurrentOdds } from "@/lib/admin/odds";
import { replaceOddsFromCsv } from "@/lib/admin/oddsCsv";
import type { CsvActionResult } from "../_components/CsvImportPanel";

export async function createAthlete(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("athletes").insert({
    season_id: String(formData.get("season_id")),
    first_name: String(formData.get("first_name")).trim(),
    last_name: String(formData.get("last_name")).trim(),
    nation_code: String(formData.get("nation_code")),
    sex: String(formData.get("sex")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
}

export async function createNation(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("nations").upsert({
    code: String(formData.get("code")).trim().toUpperCase(),
    name: String(formData.get("name")).trim(),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
}

/**
 * Enregistre une ligne du tableau (athlète, équipe ou nation) : chaque champ `odds_<format>`
 * modifié remplace la cote courante, un champ vidé la retire.
 */
export async function updateOddsRow(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const seasonId = String(formData.get("season_id"));
  const athleteId = String(formData.get("athlete_id") ?? "") || undefined;
  const nationCode = String(formData.get("nation_code") ?? "") || undefined;
  const nationSex = String(formData.get("nation_sex") ?? "") || undefined;
  const target = { seasonId, athleteId, nationCode: athleteId ? undefined : nationCode, nationSex: athleteId ? undefined : nationSex };

  let query = admin.from("odds").select("format, value").eq("season_id", seasonId).is("valid_until", null);
  if (athleteId) query = query.eq("athlete_id", athleteId);
  else {
    query = query.eq("nation_code", nationCode!);
    query = nationSex ? query.eq("nation_sex", nationSex) : query.is("nation_sex", null);
  }
  const { data: current } = await query;
  const currentByFormat = new Map((current ?? []).map((o) => [o.format as string, o.value as number]));

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("odds_")) continue;
    const format = key.slice("odds_".length);
    const text = String(raw).trim();
    const previous = currentByFormat.get(format);

    if (text === "") {
      if (previous != null) await clearCurrentOdds(admin, { ...target, format });
      continue;
    }
    const value = Number(text);
    if (!Number.isInteger(value) || value <= 0 || value === previous) continue;
    await setCurrentOdds(admin, { ...target, format, value });
  }

  revalidatePath("/admin/athletes");
}

export async function importOdds(seasonId: string, csvText: string): Promise<CsvActionResult> {
  await requireAdmin();
  const result = await replaceOddsFromCsv(createAdminClient(), seasonId, csvText);
  revalidatePath("/admin", "layout");

  if (result.status === "error") {
    return { ok: false, message: "Import refusé, aucune cote modifiée :", errors: result.errors, warnings: result.warnings };
  }
  return {
    ok: true,
    message:
      `${result.oddsWritten} cote(s) importée(s), ${result.oddsReplaced} ancienne(s) remplacée(s). ` +
      `${result.athletesCreated} athlète(s) créé(s), ${result.athletesMatched} retrouvé(s).`,
    errors: [],
    warnings: result.warnings,
  };
}
