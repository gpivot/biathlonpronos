"use server";

import { revalidatePath } from "next/cache";
import { isSpecialRuleAllowed } from "../_components/labels";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { importCalendarCsv } from "@/lib/admin/calendarImport";
import { deleteStage } from "@/lib/admin/raceResults";
import type { CsvActionResult } from "../_components/CsvImportPanel";

export async function createSeason(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("seasons").insert({
    label: String(formData.get("label")),
    starts_on: String(formData.get("starts_on")),
    ends_on: String(formData.get("ends_on")),
    status: "preparation",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function activateSeason(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const seasonId = String(formData.get("season_id"));

  await admin.from("seasons").update({ status: "preparation" }).eq("status", "active");

  const { error } = await admin.from("seasons").update({ status: "active" }).eq("id", seasonId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
}

export async function createStage(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("stages").insert({
    season_id: String(formData.get("season_id")),
    location: String(formData.get("location")),
    country_code: String(formData.get("country_code")),
    starts_on: String(formData.get("starts_on")),
    ends_on: String(formData.get("ends_on")),
    coefficient: Number(formData.get("coefficient")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function createRace(formData: FormData) {
  await requireAdmin();
  const sex = String(formData.get("sex"));
  const specialRule = String(formData.get("special_rule"));
  const format = String(formData.get("format"));
  if (!isSpecialRuleAllowed(format, specialRule)) throw new Error("Brouillard : seulement sur un sprint ou une individuelle.");

  // L'input datetime-local ne porte pas de fuseau ; on le traite comme UTC
  // (cohérent avec supabase/seed.sql) pour éviter toute ambiguïté serveur.
  const locksAt = `${String(formData.get("locks_at"))}:00Z`;

  // relais_h/relais_f encodent déjà le sexe dans leur libellé ("Relais
  // Hommes"/"Relais Femmes") — le stocker en plus produirait un affichage
  // redondant ("Relais Femmes Femmes") pour aucun bénéfice fonctionnel.
  const isSexEncodedInFormat = format === "relais_h" || format === "relais_f";
  const isMixed = format === "relais_mixte" || format === "relais_mixte_simple";

  const { error } = await createAdminClient().from("races").insert({
    stage_id: String(formData.get("stage_id")),
    format,
    sex: sex === "" || isSexEncodedInFormat || isMixed ? null : sex,
    locks_at: locksAt,
    special_rule: specialRule === "" ? null : specialRule,
    status: "upcoming",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function importCalendar(seasonId: string, csvText: string): Promise<CsvActionResult> {
  await requireAdmin();
  const summary = await importCalendarCsv(createAdminClient(), seasonId, csvText);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message:
      `${summary.stagesCreated} étape(s) créée(s), ${summary.stagesUpdated} mise(s) à jour ; ` +
      `${summary.racesCreated} course(s) créée(s), ${summary.racesUpdated} mise(s) à jour.`,
    errors: [],
    warnings: summary.warnings,
  };
}

export async function removeStage(formData: FormData) {
  await requireAdmin();
  await deleteStage(createAdminClient(), String(formData.get("stage_id")));
  revalidatePath("/admin", "layout");
}

/**
 * Supprime une saison et, par cascade en base, tout ce qui lui appartient : étapes, courses,
 * athlètes, cotes, pronostics, résultats, points, ligues, cartes, Pépites.
 */
export async function removeSeason(formData: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("seasons").delete().eq("id", String(formData.get("season_id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}
