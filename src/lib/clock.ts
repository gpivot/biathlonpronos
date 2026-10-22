import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SIMULATED_CLOCK_COOKIE, applyClockOffset, parseClockOffset } from "./simulatedClock";

export interface Clock {
  /** « Maintenant » pour l'affichage : simulé si l'admin a réglé l'horloge. */
  now: Date;
  simulated: boolean;
}

/**
 * Horloge de la requête en cours (Server Components / actions uniquement).
 * Le décalage fait foi dans profiles.simulated_clock_offset_ms (le même que
 * celui qu'applique la base via effective_now()) et n'est pris en compte que
 * pour un admin. Le cookie sert seulement à éviter une requête au profil
 * quand aucune simulation n'est active.
 */
export const getClock = cache(async (): Promise<Clock> => {
  const realNow = new Date();
  if (parseClockOffset(cookies().get(SIMULATED_CLOCK_COOKIE)?.value) === null) return { now: realNow, simulated: false };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { now: realNow, simulated: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, simulated_clock_offset_ms")
    .eq("id", user.id)
    .maybeSingle();
  const offset = profile?.is_admin ? parseClockOffset(profile.simulated_clock_offset_ms?.toString()) : null;
  if (offset === null) return { now: realNow, simulated: false };

  return { now: applyClockOffset(offset, realNow), simulated: true };
});
