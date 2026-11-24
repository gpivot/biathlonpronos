import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * L'équipe favorite se choisit à tout moment tant que la carte Équipe du joueur n'est pas active :
 * une fois activée, elle s'appliquerait sans équipe (migration 0028). Elle est modifiable jusqu'au
 * départ de la 1re course de Coupe du Monde, puis définitive (seasonChoices.ts, migration 0046).
 */
export async function isEquipeCardActive(supabase: SupabaseClient, userId: string, seasonId: string): Promise<boolean> {
  const { count } = await supabase
    .from("bonus_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("season_id", seasonId)
    .eq("card_type", "equipe")
    .eq("status", "used");
  return (count ?? 0) > 0;
}
