"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { setCurrentOdds } from "@/lib/admin/odds";

export async function updateRelayOdds(formData: FormData) {
  const admin = createAdminClient();

  const value = Number(formData.get("value"));
  if (!Number.isFinite(value) || value <= 0) return;

  const format = String(formData.get("format"));
  const nationSex = String(formData.get("nation_sex"));

  await setCurrentOdds(admin, {
    seasonId: String(formData.get("season_id")),
    format,
    nationCode: String(formData.get("nation_code")),
    nationSex: nationSex === "" ? undefined : nationSex,
    value,
  });

  revalidatePath("/admin/relais");
}
