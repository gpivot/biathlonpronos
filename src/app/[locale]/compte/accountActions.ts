"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { leagueFates } from "@/lib/account/leagueOwnership";

/**
 * Suppression du compte par le joueur lui-même (exigence de l'App Store et de Google Play).
 * Supprimer l'utilisateur Supabase efface en cascade son profil et tout ce qui y est rattaché
 * (pronostics, points, cartes, ligues rejointes, notifications…). Seules les ligues qu'il a
 * créées bloqueraient la cascade (owner_id sans « on delete cascade ») : elles passent d'abord
 * au membre le plus ancien, ou sont supprimées s'il n'en reste aucun.
 */
export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not-signed-in" };

  const admin = createAdminClient();
  const { data: owned, error: ownedError } = await admin.from("leagues").select("id").eq("owner_id", user.id);
  if (ownedError) return { ok: false, error: ownedError.message };

  const ownedIds = (owned ?? []).map((l) => l.id as string);
  if (ownedIds.length > 0) {
    const { data: memberships, error } = await admin
      .from("league_memberships")
      .select("league_id, user_id, joined_at")
      .in("league_id", ownedIds);
    if (error) return { ok: false, error: error.message };

    for (const fate of leagueFates(ownedIds, memberships ?? [], user.id)) {
      const { error: fateError } =
        "delete" in fate
          ? await admin.from("leagues").delete().eq("id", fate.leagueId)
          : await admin.from("leagues").update({ owner_id: fate.newOwnerId }).eq("id", fate.leagueId);
      if (fateError) return { ok: false, error: fateError.message };
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return { ok: false, error: deleteError.message };

  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
}
