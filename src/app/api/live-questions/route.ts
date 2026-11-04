import { NextResponse } from "next/server";
import { fetchLiveQuestionInvites } from "@/lib/bonusQuestionActions";

export const dynamic = "force-dynamic";

/**
 * Questions live ouvertes sans réponse du joueur, lues par le pop-up (LiveQuestionPopup) à chaque
 * changement de page et toutes les minutes. Simple requête GET plutôt qu'une action serveur : Next.js
 * fait passer les actions serveur dans la même file que les changements de page, et une action en
 * cours au moment d'un clic force ensuite un rechargement complet de la page.
 */
export async function GET() {
  const invites = await fetchLiveQuestionInvites().catch(() => []);
  return NextResponse.json(invites, { headers: { "Cache-Control": "private, no-store" } });
}
