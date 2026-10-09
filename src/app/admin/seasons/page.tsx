import { createAdminClient } from "@/lib/supabase/server";
import { activateSeason, createSeason } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSeasonsPage() {
  const admin = createAdminClient();
  const { data: seasons } = await admin.from("seasons").select("*").order("starts_on", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Saisons</h1>

      <form action={createSeason} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-text-dim">Nouvelle saison</div>
        <div className="flex flex-wrap gap-2">
          <input
            name="label"
            required
            placeholder="Label (ex. 2026-27)"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            name="starts_on"
            type="date"
            required
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            name="ends_on"
            type="date"
            required
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024]">
            Créer
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {(seasons ?? []).map((season) => (
          <div
            key={season.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold">{season.label}</div>
              <div className="text-xs text-text-dim">
                {season.starts_on} → {season.ends_on}
              </div>
            </div>
            {season.status === "active" ? (
              <span className="rounded-full bg-ice-soft px-3 py-1 text-xs font-semibold text-ice">active</span>
            ) : (
              <form action={activateSeason}>
                <input type="hidden" name="season_id" value={season.id} />
                <button type="submit" className="rounded border border-border px-3 py-1 text-xs">
                  Activer
                </button>
              </form>
            )}
          </div>
        ))}

        {(!seasons || seasons.length === 0) && (
          <p className="text-sm text-text-dim">Aucune saison. Crée-en une ci-dessus pour commencer.</p>
        )}
      </div>
    </div>
  );
}
