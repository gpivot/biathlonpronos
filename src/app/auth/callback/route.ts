import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Point d'entrée du flux OAuth (Google / Apple / Facebook) — échange le code retourné
// par Supabase contre une session, puis redirige vers l'accueil. En cas d'échec (refus du
// fournisseur, compte sans e-mail, code expiré…), renvoie vers la page de connexion avec le
// détail de l'erreur, affiché sous les boutons.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  let detail = providerError;
  if (!detail && code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) detail = error.message;
  } else if (!detail) {
    detail = "missing code";
  }

  if (detail) {
    return NextResponse.redirect(`${origin}/sign-in?oauth_error=${encodeURIComponent(detail)}`);
  }
  return NextResponse.redirect(`${origin}/`);
}
