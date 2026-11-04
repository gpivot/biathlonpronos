"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isAvatar } from "@/lib/avatars";

/**
 * Enregistre le picto de profil (ou l'enlève avec null). Les joueurs n'ont pas le droit de
 * modifier profiles en dehors du pseudo (migration 0016) : on écrit avec la clé service après
 * avoir vérifié l'utilisateur et que le picto fait partie de la liste.
 */
export async function setAvatar(avatar: string | null): Promise<boolean> {
  if (avatar !== null && !isAvatar(avatar)) return false;
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user || user.is_anonymous) return false;

  const { error } = await createAdminClient().from("profiles").update({ avatar }).eq("id", user.id);
  if (error) return false;
  revalidatePath("/[locale]", "layout");
  return true;
}
