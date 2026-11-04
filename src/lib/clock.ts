import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { applyClockOffset, parseClockOffset } from "./simulatedClock";

export interface Clock {
  /** « Maintenant » pour l'affichage : simulé si l'admin a réglé l'horloge. */
  now: Date;
  simulated: boolean;
}

/**
 * Horloge de la requête en cours (Server Components / actions uniquement).
 * Le décalage fait foi dans profiles.simulated_clock_offset_ms (le même que
 * celui qu'applique la base via effective_now()) et n'est pris en compte que
 * pour un admin. Le profil est lu même sans cookie : le cookie n'existe que
 * dans le navigateur où l'horloge a été réglée, alors que la base applique le
 * décalage partout : sinon, sur un autre navigateur, la page affiche « pronos
 * ouverts » (heure réelle) alors que la base refuse l'enregistrement.
 */
export const getClock = cache(async (): Promise<Clock> => {
  const realNow = new Date();

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
