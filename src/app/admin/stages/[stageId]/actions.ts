"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export async function createRace(formData: FormData) {
  const admin = createAdminClient();

  const sex = String(formData.get("sex"));
  const specialRule = String(formData.get("special_rule"));
  const stageId = String(formData.get("stage_id"));
  const format = String(formData.get("format"));

  // L'input datetime-local ne porte pas de fuseau ; on le traite comme UTC
  // (cohérent avec supabase/seed.sql) pour éviter toute ambiguïté serveur.
  const locksAt = `${String(formData.get("locks_at"))}:00Z`;

  // relais_h/relais_f encodent déjà le sexe dans leur libellé ("Relais
  // Hommes"/"Relais Femmes") — le stocker en plus produirait un affichage
  // redondant ("Relais Femmes Femmes") pour aucun bénéfice fonctionnel.
  const isSexEncodedInFormat = format === "relais_h" || format === "relais_f";

  const { error } = await admin.from("races").insert({
    stage_id: stageId,
    format,
    sex: sex === "" || isSexEncodedInFormat ? null : sex,
    locks_at: locksAt,
    special_rule: specialRule === "" ? null : specialRule,
    status: "upcoming",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/stages/${stageId}`);
}
