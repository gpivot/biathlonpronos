"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export async function setAdminRole(formData: FormData) {
  const callerId = await requireAdmin();

  const userId = String(formData.get("user_id"));
  const isAdmin = formData.get("is_admin") === "true";
  // Un admin ne peut pas se retirer ses propres droits : évite de se fermer l'accès au back-office.
  if (userId === callerId && !isAdmin) throw new Error("Tu ne peux pas retirer ton propre rôle d'admin.");

  const { error } = await createAdminClient().from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/joueurs");
}
