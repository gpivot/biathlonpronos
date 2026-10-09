import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { updateRelayOdds } from "./actions";

export const dynamic = "force-dynamic";

const RELAY_FORMATS = [
  { format: "relais_h", nationSex: "H", label: "Relais H" },
  { format: "relais_f", nationSex: "F", label: "Relais F" },
  { format: "relais_mixte", nationSex: "", label: "Mixte" },
  { format: "relais_mixte_simple", nationSex: "", label: "Mixte simple" },
] as const;

export default async function AdminRelaisPage() {
  const admin = createAdminClient();

  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Cotes de relais</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/seasons" className="underline">Active une saison</Link> avant
          de saisir des cotes de relais.
        </p>
      </div>
    );
  }

  const [{ data: nations }, { data: odds }] = await Promise.all([
    admin.from("nations").select("*").order("name"),
    admin
      .from("odds")
      .select("nation_code, format, value")
      .eq("season_id", season.id)
      .is("valid_until", null)
      .in("format", RELAY_FORMATS.map((f) => f.format)),
  ]);

  const oddsByNationAndFormat = new Map<string, number>();
  for (const o of odds ?? []) {
    if (o.nation_code) oddsByNationAndFormat.set(`${o.nation_code}:${o.format}`, o.value);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Cotes de relais — {season.label}</h1>
      <p className="text-sm text-text-dim">
        Une cote par nation et par format de relais (§5 du règlement) — pas de cote pour un athlète
        en particulier. Réévaluées aux mêmes pauses de saison que les autres cotes course.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-dim">
              <th className="px-3 py-2">Nation</th>
              {RELAY_FORMATS.map((f) => (
                <th key={f.format} className="px-3 py-2">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(nations ?? []).map((nation) => (
              <tr key={nation.code} className="border-b border-border/50">
                <td className="px-3 py-2">
                  {nation.name} ({nation.code})
                </td>
                {RELAY_FORMATS.map((f) => (
                  <td key={f.format} className="px-3 py-2">
                    <form action={updateRelayOdds} className="flex gap-1">
                      <input type="hidden" name="season_id" value={season.id} />
                      <input type="hidden" name="nation_code" value={nation.code} />
                      <input type="hidden" name="nation_sex" value={f.nationSex} />
                      <input type="hidden" name="format" value={f.format} />
                      <input
                        name="value"
                        type="number"
                        min={1}
                        defaultValue={oddsByNationAndFormat.get(`${nation.code}:${f.format}`) ?? ""}
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
    </div>
  );
}
