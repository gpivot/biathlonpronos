"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { CLAIMABLE_CARD_TYPES } from "@/lib/bonusCards";
import { fromParisWallTime } from "@/lib/displayTimeZone";

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) throw new Error("Réservé aux admins");
}

/** Date du formulaire (jour, heure de Paris) → instant : début du jour pour « à partir du », fin du jour pour « jusqu'au ». */
function dayBoundary(value: FormDataEntryValue | null, end: boolean): string | null {
  const day = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return fromParisWallTime(`${day}T${end ? "23:59" : "00:00"}`).toISOString();
}

/** Enregistre le réglage d'une carte (interrupteur, période, déblocage forcé) pour la saison. */
export async function saveCardSetting(formData: FormData): Promise<void> {
  await assertAdmin();
  const seasonId = String(formData.get("season_id") ?? "");
  const cardType = String(formData.get("card_type") ?? "");
  if (!seasonId || !(CLAIMABLE_CARD_TYPES as readonly string[]).includes(cardType)) throw new Error("Carte inconnue");

  const { error } = await createAdminClient()
    .from("bonus_card_settings")
    .upsert(
      {
        season_id: seasonId,
        card_type: cardType,
        enabled: formData.get("enabled") === "on",
        available_from: dayBoundary(formData.get("available_from"), false),
        available_until: dayBoundary(formData.get("available_until"), true),
        force_unlock: formData.get("force_unlock") === "on",
      },
      { onConflict: "season_id,card_type" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cartes");
}
