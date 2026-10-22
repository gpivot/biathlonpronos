"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { SIMULATED_CLOCK_COOKIE, parseClockOffset } from "@/lib/simulatedClock";

async function getAdminUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) throw new Error("Réservé aux admins");
  return user.id;
}

/**
 * Enregistre le décalage dans le profil de l'admin : c'est lui que lit la
 * base (effective_now(), migration 0017) pour autoriser les pronos, et
 * getClock() pour l'affichage. Le cookie, lisible par le navigateur, ne sert
 * qu'au bandeau d'avertissement.
 */
async function storeOffset(userId: string, offset: number | null) {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ simulated_clock_offset_ms: offset })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  if (offset === null) {
    cookies().delete(SIMULATED_CLOCK_COOKIE);
  } else {
    cookies().set(SIMULATED_CLOCK_COOKIE, String(offset), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  revalidatePath("/", "layout");
}

/** Règle l'horloge simulée sur `targetMs` (instant choisi, en ms epoch) ; la pendule continue d'avancer. */
export async function setSimulatedClock(targetMs: number) {
  const userId = await getAdminUserId();
  await storeOffset(userId, parseClockOffset(String(Math.round(targetMs - Date.now()))));
}

export async function resetSimulatedClock() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await storeOffset(user.id, null);
  } else {
    cookies().delete(SIMULATED_CLOCK_COOKIE);
    revalidatePath("/", "layout");
  }
}
