import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Client Supabase pour les Server Components / Route Handlers.
 * Lit et écrit la session dans les cookies Next.js. Utilise la clé anon —
 * respecte les policies RLS (l'utilisateur ne voit que ses propres données
 * privées : pronostics, cartes bonus, etc.).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Appelé depuis un Server Component : ignoré si un middleware
            // rafraîchit déjà la session (cf. doc @supabase/ssr).
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}

/**
 * Client "admin" — clé service_role, contourne RLS. Réservé au back-office
 * (saisie de résultats, réévaluation des cotes) exécuté côté serveur
 * uniquement. Ne jamais importer ce module depuis un Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
