"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SIMULATED_CLOCK_COOKIE, parseClockOffset } from "@/lib/simulatedClock";

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) throw new Error("Réservé aux admins");
}

/**
 * Règle l'horloge simulée sur `targetMs` (instant choisi, en ms epoch). On
 * stocke le décalage avec l'heure réelle pour que la pendule continue
 * d'avancer. Cookie lisible par le navigateur (bandeau d'avertissement) :
 * il n'accorde rien, le serveur revérifie is_admin à chaque lecture.
 */
export async function setSimulatedClock(targetMs: number) {
  await assertAdmin();
  const offset = parseClockOffset(String(Math.round(targetMs - Date.now())));
  if (offset === null) {
    cookies().delete(SIMULATED_CLOCK_COOKIE);
  } else {
    cookies().set(SIMULATED_CLOCK_COOKIE, String(offset), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  revalidatePath("/", "layout");
}

export async function resetSimulatedClock() {
  cookies().delete(SIMULATED_CLOCK_COOKIE);
  revalidatePath("/", "layout");
}
