"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { adminFormAction } from "@/lib/admin/formAction";

export const setAdminRole = adminFormAction(async (formData: FormData) => {
  const callerId = await requireAdmin();

  const userId = String(formData.get("user_id"));
  const isAdmin = formData.get("is_admin") === "true";
  // Un admin ne peut pas se retirer ses propres droits : évite de se fermer l'accès au back-office.
  if (userId === callerId && !isAdmin) throw new Error("Tu ne peux pas retirer ton propre rôle d'admin.");

  const { error } = await createAdminClient().from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/joueurs");
});

/**
 * Parcours d'invité : supprime les comptes invités (session anonyme) jamais confirmés depuis plus de
 * 7 jours. Même fonction que la purge automatique de nuit (migration 0031).
 */
export const purgeGuests = adminFormAction(async () => {
  await requireAdmin();
  const { error } = await createAdminClient().rpc("purge_anonymous_users");
  if (error) throw new Error(`${error.message} (migration 0031 appliquée ?)`);
  revalidatePath("/admin/joueurs");
});
