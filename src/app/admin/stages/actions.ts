"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export async function createStage(formData: FormData) {
  const admin = createAdminClient();

  const { error } = await admin.from("stages").insert({
    season_id: String(formData.get("season_id")),
    location: String(formData.get("location")),
    country_code: String(formData.get("country_code")),
    starts_on: String(formData.get("starts_on")),
    ends_on: String(formData.get("ends_on")),
    coefficient: Number(formData.get("coefficient")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/stages");
}
