import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { GlobesSection } from "./_globes/GlobesSection";
import { RACE_STATUS_LABELS, RACE_STATUS_STYLES, formatDateRange, formatLockTime, raceLabel } from "./_components/labels";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const admin = createAdminClient();
  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Résultats & globes</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/calendrier" className="underline">Active une saison</Link>.
        </p>
      </div>
    );
  }

  const { data: stages } = await admin
    .from("stages")
    .select("id, location, country_code, starts_on, ends_on, coefficient, races(id, format, sex, locks_at, status)")
    .eq("season_id", season.id)
    .order("starts_on");

  const sortedStages = (stages ?? []).map((stage: any) => ({
    ...stage,
    races: [...(stage.races ?? [])].sort(
      (a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()
    ),
  }));
  // Comme le Calendrier joueur : ouverte par défaut, la première étape dont une course reste à saisir.
  const defaultOpenId = sortedStages.find((s) => s.races.some((r: any) => r.status !== "finished"))?.id;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Résultats — {season.label}</h1>

      <div className="flex flex-col gap-2">
        {sortedStages.map((stage) => {
          const done = stage.races.filter((r: any) => r.status === "finished").length;
          return (
            <details key={stage.id} open={stage.id === defaultOpenId} className="rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">
                    {nationFlagEmoji(stage.country_code)} {stage.location}
                    {stage.coefficient === 2 && <span className="ml-2 text-xs text-gold">×2</span>}
                  </div>
                  <div className="text-xs text-text-dim">{formatDateRange(stage.starts_on, stage.ends_on)}</div>
                </div>
                <span className="text-xs text-text-dim">
                  {done}/{stage.races.length} saisie(s)
                </span>
              </summary>
              <div className="flex flex-col gap-1.5 border-t border-border px-3 py-3">
                {stage.races.map((race: any) => (
                  <Link
                    key={race.id}
                    href={`/admin/races/${race.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-bg"
                  >
                    <div>
                      <div className="text-sm font-semibold">{raceLabel(race)}</div>
                      <div className="text-xs text-text-dim">{formatLockTime(race.locks_at)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RACE_STATUS_STYLES[race.status] ?? ""}`}>
                      {RACE_STATUS_LABELS[race.status] ?? race.status}
                    </span>
                  </Link>
                ))}
                {stage.races.length === 0 && <p className="px-2 text-xs text-text-dim">Aucune course.</p>}
              </div>
            </details>
          );
        })}

        {sortedStages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-dim">
            Aucune étape. Crée ou importe le calendrier dans <Link href="/admin/calendrier" className="underline">Calendrier</Link>.
          </div>
        )}
      </div>

      <details className="rounded-xl border border-gold/50 bg-card">
        <summary className="cursor-pointer px-4 py-3">
          <span className="text-sm font-semibold">Globes de saison</span>
          <span className="ml-2 text-xs text-text-dim">classements finaux, à saisir en fin de saison</span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-text-dim">
            Saisis le classement final officiel (jusqu&apos;à 5 rangs) de chaque catégorie pour noter les pronostics
            de saison des joueurs.
          </p>
          <GlobesSection admin={admin} seasonId={season.id} />
        </div>
      </details>
    </div>
  );
}
