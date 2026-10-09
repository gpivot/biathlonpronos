import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { createRace } from "./actions";

export const dynamic = "force-dynamic";

const RACE_FORMATS = [
  { value: "sprint", label: "Sprint" },
  { value: "poursuite", label: "Poursuite" },
  { value: "individuel", label: "Individuel" },
  { value: "mass_start", label: "Mass Start" },
  { value: "relais_h", label: "Relais Hommes" },
  { value: "relais_f", label: "Relais Femmes" },
  { value: "relais_mixte", label: "Relais Mixte" },
  { value: "relais_mixte_simple", label: "Relais Mixte Simple" },
];

const SPECIAL_RULES = [
  { value: "", label: "Aucune" },
  { value: "tour_de_pena", label: "Tour de péna" },
  { value: "brouillard", label: "Brouillard" },
  { value: "tes_colle", label: "T'es collé(e)" },
];

export default async function AdminStageDetailPage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const admin = createAdminClient();

  const { data: stage } = await admin.from("stages").select("*").eq("id", stageId).single();
  if (!stage) notFound();

  const { data: races } = await admin.from("races").select("*").eq("stage_id", stageId).order("locks_at");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/stages" className="text-sm text-text-dim underline">
        ← Retour aux étapes
      </Link>
      <h1 className="text-xl font-bold">
        {stage.location} ({stage.country_code})
      </h1>

      <form action={createRace} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-text-dim">Nouvelle course</div>
        <div className="flex flex-wrap gap-2">
          <input type="hidden" name="stage_id" value={stageId} />
          <select name="format" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            {RACE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select name="sex" className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            <option value="F">Femmes</option>
            <option value="H">Hommes</option>
            <option value="">— (relais mixte)</option>
          </select>
          <input
            name="locks_at"
            type="datetime-local"
            required
            title="Heure de verrouillage, en UTC"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <select name="special_rule" className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            {SPECIAL_RULES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024]">
            Créer
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {(races ?? []).map((race) => (
          <Link
            key={race.id}
            href={`/admin/races/${race.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold">
                {RACE_FORMATS.find((f) => f.value === race.format)?.label ?? race.format}
                {race.sex ? ` ${race.sex === "F" ? "Femmes" : "Hommes"}` : ""}
              </div>
              <div className="text-xs text-text-dim">Verrouillage : {race.locks_at}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                race.status === "finished" ? "bg-ice-soft text-ice" : "border border-border text-text-dim"
              }`}
            >
              {race.status}
            </span>
          </Link>
        ))}

        {(!races || races.length === 0) && (
          <p className="text-sm text-text-dim">Aucune course pour cette étape. Crée-en une ci-dessus.</p>
        )}
      </div>
    </div>
  );
}
