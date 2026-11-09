import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runReminders, runWeeklyRecap } from "@/lib/notifications/jobs";
import { runStartListOpening } from "@/lib/admin/startListOpening";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Appelé tous les quarts d'heure par Supabase (pg_cron + pg_net, voir docs/notifications.md) :
 * rappels de pronostic 2 h avant les courses, le lundi matin, récap de la semaine par e-mail, et
 * le lundi à partir de 15 h, liste de départ provisoire des étapes qui ouvrent à 17 h (top 60 du
 * général, voir startListOpening.ts).
 * Protégé par le secret CRON_SECRET (variable d'environnement Vercel), envoyé en en-tête
 * « Authorization: Bearer … ».
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const report: string[] = [];
  for (const job of [runStartListOpening, runReminders, runWeeklyRecap]) {
    try {
      report.push(await job(admin, now));
    } catch (error) {
      report.push(`Erreur : ${error instanceof Error ? error.message : "inconnue"}`);
    }
  }
  return NextResponse.json({ ok: true, report });
}

export const GET = handle;
export const POST = handle;
