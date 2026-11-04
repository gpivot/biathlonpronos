import { NextResponse } from "next/server";
import { registerPushToken } from "@/lib/push/actions";

export const dynamic = "force-dynamic";

/**
 * Enregistrement du jeton de notification par l'appli (PushRegistrar), au lancement et après la
 * connexion. Requête POST plutôt qu'une action serveur pour ne pas bloquer ni faire recharger la
 * page ouverte en touchant une notification (même raison que /api/live-questions).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { token, platform, locale } = (body ?? {}) as Record<string, unknown>;
  try {
    const ok = await registerPushToken(String(token ?? ""), String(platform ?? ""), String(locale ?? ""));
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
