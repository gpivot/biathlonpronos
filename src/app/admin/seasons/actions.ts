"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export async function createSeason(formData: FormData) {
  const admin = createAdminClient();

  const { error } = await admin.from("seasons").insert({
    label: String(formData.get("label")),
    starts_on: String(formData.get("starts_on")),
    ends_on: String(formData.get("ends_on")),
    status: "preparation",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/seasons");
}

export async function activateSeason(formData: FormData) {
  const admin = createAdminClient();
  const seasonId = String(formData.get("season_id"));

  await admin.from("seasons").update({ status: "preparation" }).eq("status", "active");

  const { error } = await admin.from("seasons").update({ status: "active" }).eq("id", seasonId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/seasons");
}
