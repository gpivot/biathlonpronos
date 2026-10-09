import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  sprint: "Sprint",
  poursuite: "Poursuite",
  individuel: "Individuel",
  mass_start: "Mass Start",
  relais_h: "Relais Hommes",
  relais_f: "Relais Femmes",
  relais_mixte: "Relais Mixte",
  relais_mixte_simple: "Relais Mixte Simple",
};

export default async function AdminHomePage() {
  const supabase = createAdminClient();

  const { data: races } = await supabase
    .from("races")
    .select("*, stages(location, starts_on)")
    .order("locks_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Back-office — Saisie des résultats</h1>

      <div className="flex flex-col gap-2">
        {(races ?? []).map((race: any) => (
          <Link
            key={race.id}
            href={`/admin/races/${race.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-semibold">
                {FORMAT_LABELS[race.format] ?? race.format}
                {race.sex ? ` ${race.sex === "F" ? "Femmes" : "Hommes"}` : ""}
              </div>
              <div className="text-xs text-text-dim">{race.stages?.location}</div>
            </div>
            <div
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                race.status === "finished"
                  ? "bg-ice-soft text-ice"
                  : race.status === "locked"
                    ? "bg-gold-soft text-gold"
                    : "border border-border text-text-dim"
              }`}
            >
              {race.status}
            </div>
          </Link>
        ))}

        {(!races || races.length === 0) && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-dim">
            Aucune course. Ajoute une saison, une étape et des courses dans Supabase.
          </div>
        )}
      </div>
    </div>
  );
}
