import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SIMULATED_CLOCK_COOKIE, applyClockOffset, parseClockOffset } from "./simulatedClock";

export interface Clock {
  /** « Maintenant » pour l'affichage : simulé si l'admin a réglé l'horloge. */
  now: Date;
  /** Heure réelle du serveur — celle qu'applique la base (RLS). */
  realNow: Date;
  simulated: boolean;
}

/**
 * Horloge de la requête en cours (Server Components / actions uniquement).
 * Le cookie de simulation n'est pris en compte que pour un admin : un joueur
 * qui le fabriquerait garde l'heure réelle.
 */
export const getClock = cache(async (): Promise<Clock> => {
  const realNow = new Date();
  const offset = parseClockOffset(cookies().get(SIMULATED_CLOCK_COOKIE)?.value);
  if (offset === null) return { now: realNow, realNow, simulated: false };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { now: realNow, realNow, simulated: false };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return { now: realNow, realNow, simulated: false };

  return { now: applyClockOffset(offset, realNow), realNow, simulated: true };
});
