import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { unsubscribeByToken } from "@/lib/notifications/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Désabonnement « en un clic » depuis la messagerie (bouton « Se désabonner » de Gmail, Yahoo,
 * Apple Mail), exigé pour les envois en nombre : la messagerie envoie un POST sur l'adresse de
 * l'en-tête List-Unsubscribe. Le lien visible dans l'e-mail mène, lui, à la page /desabonnement.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribeByToken(createAdminClient(), url.searchParams.get("t"), url.searchParams.get("k"));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
