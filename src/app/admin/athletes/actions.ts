"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { setCurrentOdds } from "@/lib/admin/odds";

export async function createAthlete(formData: FormData) {
  const admin = createAdminClient();

  const { error } = await admin.from("athletes").insert({
    season_id: String(formData.get("season_id")),
    first_name: String(formData.get("first_name")),
    last_name: String(formData.get("last_name")),
    nation_code: String(formData.get("nation_code")),
    sex: String(formData.get("sex")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
}

export async function createNation(formData: FormData) {
  const admin = createAdminClient();

  const { error } = await admin.from("nations").upsert({
    code: String(formData.get("code")).toUpperCase(),
    name: String(formData.get("name")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
}

export async function updateAthleteOdds(formData: FormData) {
  const admin = createAdminClient();

  const value = Number(formData.get("value"));
  if (!Number.isFinite(value) || value <= 0) return;

  await setCurrentOdds(admin, {
    seasonId: String(formData.get("season_id")),
    format: String(formData.get("format")),
    athleteId: String(formData.get("athlete_id")),
    value,
  });

  revalidatePath("/admin/athletes");
}
