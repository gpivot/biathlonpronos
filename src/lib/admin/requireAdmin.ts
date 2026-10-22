import { createClient } from "@/lib/supabase/server";

/**
 * Vérifie que l'appelant est connecté et admin. Le layout /admin protège les pages, mais une
 * Server Action peut être appelée directement : celles qui touchent aux droits doivent revérifier.
 * Renvoie l'id de l'admin appelant.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Connexion requise.");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Réservé aux admins.");

  return user.id;
}
