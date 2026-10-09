import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { createAthlete, createNation, updateAthleteOdds } from "./actions";

export const dynamic = "force-dynamic";

const ODDS_FORMATS = ["sprint", "individuel", "mass_start"] as const;

export default async function AdminAthletesPage() {
  const admin = createAdminClient();

  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Athlètes & cotes</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/seasons" className="underline">Active une saison</Link> avant
          d'ajouter des athlètes.
        </p>
      </div>
    );
  }

  const [{ data: nations }, { data: athletes }, { data: odds }] = await Promise.all([
    admin.from("nations").select("*").order("name"),
    admin.from("athletes").select("*").eq("season_id", season.id).order("last_name"),
    admin
      .from("odds")
      .select("athlete_id, format, value")
      .eq("season_id", season.id)
      .is("valid_until", null)
      .in("format", ODDS_FORMATS),
  ]);

  const oddsByAthleteId = new Map<string, Record<string, number>>();
  for (const o of odds ?? []) {
    if (!o.athlete_id) continue;
    const current = oddsByAthleteId.get(o.athlete_id) ?? {};
    current[o.format] = o.value;
    oddsByAthleteId.set(o.athlete_id, current);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Athlètes & cotes — {season.label}</h1>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-text-dim">Nouvel athlète</div>
        <form action={createAthlete} className="flex flex-wrap gap-2">
          <input type="hidden" name="season_id" value={season.id} />
          <input name="first_name" required placeholder="Prénom" className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
          <input name="last_name" required placeholder="Nom" className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
          <select name="nation_code" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            {(nations ?? []).map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </select>
          <select name="sex" required className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            <option value="F">Femme</option>
            <option value="H">Homme</option>
          </select>
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024]">
            Ajouter
          </button>
        </form>

        <details>
          <summary className="cursor-pointer text-xs text-text-dim">Nation manquante ? Ajoute-la ici.</summary>
          <form action={createNation} className="mt-2 flex gap-2">
            <input name="code" required placeholder="Code (ex. USA)" maxLength={3} className="w-24 rounded border border-border bg-bg px-2 py-1.5 text-sm" />
            <input name="name" required placeholder="Nom (ex. États-Unis)" className="rounded border border-border bg-bg px-2 py-1.5 text-sm" />
            <button type="submit" className="rounded border border-border px-3 py-1.5 text-xs">
              Ajouter la nation
            </button>
          </form>
        </details>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-dim">
              <th className="px-3 py-2">Athlète</th>
              <th className="px-3 py-2">Nation</th>
              {ODDS_FORMATS.map((format) => (
                <th key={format} className="px-3 py-2">
                  Cote {format}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(athletes ?? []).map((athlete) => (
              <tr key={athlete.id} className="border-b border-border/50">
                <td className="px-3 py-2">
                  {athlete.first_name} {athlete.last_name}
                </td>
                <td className="px-3 py-2 text-text-dim">
                  {athlete.nation_code} ({athlete.sex})
                </td>
                {ODDS_FORMATS.map((format) => (
                  <td key={format} className="px-3 py-2">
                    <form action={updateAthleteOdds} className="flex gap-1">
                      <input type="hidden" name="season_id" value={season.id} />
                      <input type="hidden" name="athlete_id" value={athlete.id} />
                      <input type="hidden" name="format" value={format} />
                      <input
                        name="value"
                        type="number"
                        min={1}
                        defaultValue={oddsByAthleteId.get(athlete.id)?.[format] ?? ""}
                        className="w-16 rounded border border-border bg-card px-2 py-1"
                      />
                      <button type="submit" className="rounded border border-border px-2 text-xs">
                        OK
                      </button>
                    </form>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!athletes || athletes.length === 0) && (
        <p className="text-sm text-text-dim">Aucun athlète pour cette saison. Ajoute-en un ci-dessus.</p>
      )}
    </div>
  );
}
