import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { fetchLiveQuestionInvites } from "@/lib/bonusQuestionActions";

export const dynamic = "force-dynamic";

/** Relecture toutes les minutes quand une course est en cours (questions live possibles). */
const POLL_LIVE_MS = 60_000;
/** Sinon, toutes les 10 minutes : aucune question live ne peut s'ouvrir hors course. */
const POLL_IDLE_MS = 10 * 60_000;
/** Une course est « en cours » pendant les 3 h qui suivent son départ. */
const RACE_WINDOW_MS = 3 * 3600_000;

/**
 * Questions live ouvertes sans réponse du joueur, lues par le pop-up (LiveQuestionPopup) à chaque
 * changement de page et à intervalle régulier. Simple requête GET plutôt qu'une action serveur : Next.js
 * fait passer les actions serveur dans la même file que les changements de page, et une action en
 * cours au moment d'un clic force ensuite un rechargement complet de la page.
 *
 * Économie de calcul Vercel (28/11/2026) : la réponse indique au navigateur quand relire
 * (`nextPollMs`). Visiteur non connecté : `null`, plus de relecture périodique. Hors course : 10 min.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return NextResponse.json({ invites: [], nextPollMs: null }, { headers });

  const invites = await fetchLiveQuestionInvites().catch(() => []);
  let nextPollMs = POLL_LIVE_MS;
  if (invites.length === 0) {
    const now = Date.now();
    const { count } = await createClient()
      .from("races")
      .select("id", { count: "exact", head: true })
      .lte("locks_at", new Date(now).toISOString())
      .gte("locks_at", new Date(now - RACE_WINDOW_MS).toISOString());
    if (!count) nextPollMs = POLL_IDLE_MS;
  }
  return NextResponse.json({ invites, nextPollMs }, { headers });
}
