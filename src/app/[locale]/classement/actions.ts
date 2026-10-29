"use server";

import { createClient } from "@/lib/supabase/server";
import { getClock } from "@/lib/clock";
import { getSeasonView, pickDefaultOpenStageId, type SeasonView } from "@/lib/seasonView";

export interface PlayerSeason extends SeasonView {
  pseudo: string;
  defaultOpenStageId: string | null;
}

/**
 * Pop-up d'un joueur du Classement : sa page « Ma saison » en lecture seule. Ses pronostics
 * sur les courses pas encore parties restent cachés (cf. getSeasonView et migration 0018).
 */
export async function getPlayerSeason(userId: string): Promise<PlayerSeason | null> {
  const supabase = createClient();
  const [{ data: season }, { data: profile }, { data: userResult }] = await Promise.all([
    supabase.from("seasons").select("id, starts_on").eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("pseudo").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!season || !profile) return null;

  const { now } = await getClock();
  const view = await getSeasonView(supabase, season, userId, now, userResult.user?.id === userId);
  return { ...view, pseudo: profile.pseudo ?? "?", defaultOpenStageId: pickDefaultOpenStageId(view.stages) };
}
