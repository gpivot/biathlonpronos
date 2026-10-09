import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { createStage } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminStagesPage() {
  const admin = createAdminClient();

  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Étapes & courses</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/seasons" className="underline">Active une saison</Link> avant
          d'ajouter des étapes.
        </p>
      </div>
    );
  }

  const [{ data: nations }, { data: stages }] = await Promise.all([
    admin.from("nations").select("*").order("name"),
    admin.from("stages").select("*").eq("season_id", season.id).order("starts_on"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Étapes & courses — {season.label}</h1>

      <form action={createStage} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-text-dim">Nouvelle étape</div>
        <div className="flex flex-wrap gap-2">
          <input type="hidden" name="season_id" value={season.id} />
          <input name="location" required placeholder="Lieu (ex. Kontiolahti)" className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
          <select name="country_code" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            {(nations ?? []).map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </select>
          <input name="starts_on" type="date" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
          <input name="ends_on" type="date" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
          <select name="coefficient" className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            <option value="1">Coupe du Monde (×1)</option>
            <option value="2">Mondiaux / JO (×2)</option>
          </select>
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024]">
            Créer
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {(stages ?? []).map((stage) => (
          <Link
            key={stage.id}
            href={`/admin/stages/${stage.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold">
                {stage.location} ({stage.country_code})
              </div>
              <div className="text-xs text-text-dim">
                {stage.starts_on} → {stage.ends_on}
              </div>
            </div>
            {stage.coefficient === 2 && (
              <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold">×2</span>
            )}
          </Link>
        ))}

        {(!stages || stages.length === 0) && (
          <p className="text-sm text-text-dim">Aucune étape pour cette saison. Crée-en une ci-dessus.</p>
        )}
      </div>
    </div>
  );
}
