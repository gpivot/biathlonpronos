import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/admin/fetchAll";
import { ODDS_CSV_HEADERS } from "@/lib/admin/oddsCsv";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { CsvImportPanel } from "../_components/CsvImportPanel";
import { createAthlete, createNation, importOdds, updateOddsRow } from "./actions";

export const dynamic = "force-dynamic";

const ATHLETE_FORMATS = [
  { format: "sprint", label: "Sprint" },
  { format: "poursuite", label: "Poursuite" },
  { format: "individuel", label: "Indiv." },
  { format: "mass_start", label: "Mass" },
  { format: "gros_globe", label: "Globe" },
  { format: "meilleur_jeune", label: "Jeune" },
];

const SEXES = [
  { value: "F", team: "Équipe féminine", relay: "relais_f" },
  { value: "H", team: "Équipe masculine", relay: "relais_h" },
] as const;

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";
const oddsInputClass = "w-14 rounded border border-border bg-card px-1.5 py-1 text-sm";

type OddsMap = Record<string, number>;

/** Ligne de cotes d'une nation ou d'une équipe : quelques champs et un bouton. */
function NationOddsForm({
  seasonId,
  nationCode,
  nationSex,
  title,
  fields,
  odds,
}: {
  seasonId: string;
  nationCode: string;
  nationSex: string;
  title: string;
  fields: Array<{ format: string; label: string }>;
  odds: OddsMap;
}) {
  return (
    <form action={updateOddsRow} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-bg/60 px-3 py-2 text-sm">
      <input type="hidden" name="season_id" value={seasonId} />
      <input type="hidden" name="nation_code" value={nationCode} />
      <input type="hidden" name="nation_sex" value={nationSex} />
      <span className="min-w-[9rem] font-semibold">{title}</span>
      {fields.map((f) => (
        <label key={f.format} className="flex items-center gap-1.5 text-xs text-text-dim">
          {f.label}
          <input name={`odds_${f.format}`} type="number" min={1} defaultValue={odds[f.format] ?? ""} className={oddsInputClass} />
        </label>
      ))}
      <button type="submit" className="rounded border border-border px-2 py-1 text-xs">
        OK
      </button>
    </form>
  );
}

export default async function AdminAthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ nation?: string; sexe?: string }>;
}) {
  const { nation: nationFilter = "", sexe: sexFilter = "" } = await searchParams;
  const admin = createAdminClient();

  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Athlètes & cotes</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/calendrier" className="underline">Active une saison</Link> avant
          d&apos;ajouter des athlètes.
        </p>
      </div>
    );
  }

  const [{ data: nations }, { data: athletes }, odds] = await Promise.all([
    admin.from("nations").select("*").order("name"),
    admin.from("athletes").select("*").eq("season_id", season.id).order("last_name"),
    fetchAll((from, to) =>
      admin
        .from("odds")
        .select("athlete_id, nation_code, nation_sex, format, value")
        .eq("season_id", season.id)
        .is("valid_until", null)
        .order("id")
        .range(from, to)
    ),
  ]);

  const athleteOdds = new Map<string, OddsMap>();
  const nationOdds = new Map<string, OddsMap>(); // clé : code|sexe ("" pour les relais mixtes)
  for (const o of odds) {
    if (o.athlete_id) athleteOdds.set(o.athlete_id, { ...athleteOdds.get(o.athlete_id), [o.format]: o.value });
    else if (o.nation_code) {
      const key = `${o.nation_code}|${o.nation_sex ?? ""}`;
      nationOdds.set(key, { ...nationOdds.get(key), [o.format]: o.value });
    }
  }

  const shownSexes = SEXES.filter((s) => !sexFilter || s.value === sexFilter);
  const activeCodes = new Set([
    ...(athletes ?? []).map((a) => a.nation_code),
    ...odds.filter((o) => o.nation_code).map((o) => o.nation_code as string),
  ]);
  const shownNations = (nations ?? []).filter((n) => (nationFilter ? n.code === nationFilter : activeCodes.has(n.code)));
  const isFiltered = Boolean(nationFilter);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Athlètes & cotes — {season.label}</h1>

      <CsvImportPanel
        title="Cotes en CSV (un seul fichier)"
        description={
          <>
            Pour chaque nation : une ligne <b>Nation</b> (relais mixte, relais mixte simple), une ligne{" "}
            <b>Équipe</b> F (relais, meilleure nation) puis une ligne <b>Athlète</b> par athlète féminine, puis
            l&apos;équipe H et ses athlètes. Nation en code à 3 lettres (FRA, NOR…), sexe F ou H, cotes en
            nombres entiers, case vide = pas de cote. <b>L&apos;import remplace toutes les cotes en cours</b>{" "}
            (les anciennes restent dans l&apos;historique) ; un fichier avec une erreur n&apos;est pas importé du
            tout. Télécharge le fichier en cours pour partir d&apos;un modèle rempli.
          </>
        }
        headers={ODDS_CSV_HEADERS}
        downloadHref="/admin/athletes/export"
        confirmMessage="Cet import remplace toutes les cotes en cours de la saison par celles du fichier. Continuer ?"
        onImport={importOdds.bind(null, season.id)}
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <select name="nation" defaultValue={nationFilter} className={inputClass}>
          <option value="">Toutes les nations</option>
          {(nations ?? []).map((n) => (
            <option key={n.code} value={n.code}>
              {n.name} ({n.code})
            </option>
          ))}
        </select>
        <select name="sexe" defaultValue={sexFilter} className={inputClass}>
          <option value="">Femmes et hommes</option>
          <option value="F">Femmes</option>
          <option value="H">Hommes</option>
        </select>
        <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
          Filtrer
        </button>
        {(nationFilter || sexFilter) && (
          <Link href="/admin/athletes" className="text-xs text-text-dim underline">
            Tout afficher
          </Link>
        )}
      </form>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-xs font-semibold text-text-dim">Ajouter un athlète ou une nation</summary>
        <form action={createAthlete} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="season_id" value={season.id} />
          <input name="first_name" required placeholder="Prénom" className={inputClass} />
          <input name="last_name" required placeholder="Nom" className={inputClass} />
          <select name="nation_code" required defaultValue={nationFilter} className={inputClass}>
            {(nations ?? []).map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </select>
          <select name="sex" required defaultValue={sexFilter || "F"} className={inputClass}>
            <option value="F">Femme</option>
            <option value="H">Homme</option>
          </select>
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
            Ajouter l&apos;athlète
          </button>
        </form>
        <form action={createNation} className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
          <input name="code" required placeholder="Code (ex. USA)" maxLength={3} className={`w-28 ${inputClass}`} />
          <input name="name" required placeholder="Nom (ex. États-Unis)" className={inputClass} />
          <button type="submit" className="rounded border border-border px-3 py-1.5 text-xs">
            Ajouter la nation
          </button>
        </form>
      </details>

      <div className="flex flex-col gap-2">
        {shownNations.map((nation) => {
          const mixed = nationOdds.get(`${nation.code}|`) ?? {};
          const countBySex = (sex: string) => (athletes ?? []).filter((a) => a.nation_code === nation.code && a.sex === sex).length;

          return (
            <details key={nation.code} open={isFiltered} className="rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold">
                  {nationFlagEmoji(nation.code)} {nation.name} <span className="text-text-dim">({nation.code})</span>
                </span>
                <span className="text-xs text-text-dim">
                  {countBySex("F")} F · {countBySex("H")} H
                  {mixed.relais_mixte != null && ` · mixte ×${mixed.relais_mixte}`}
                </span>
              </summary>

              <div className="flex flex-col gap-4 border-t border-border px-4 py-3">
                <NationOddsForm
                  seasonId={season.id}
                  nationCode={nation.code}
                  nationSex=""
                  title="Relais mixtes"
                  fields={[
                    { format: "relais_mixte", label: "Mixte" },
                    { format: "relais_mixte_simple", label: "Mixte simple" },
                  ]}
                  odds={mixed}
                />

                {shownSexes.map((sex) => {
                  const members = (athletes ?? []).filter((a) => a.nation_code === nation.code && a.sex === sex.value);
                  return (
                    <div key={sex.value} className="flex flex-col gap-2">
                      <NationOddsForm
                        seasonId={season.id}
                        nationCode={nation.code}
                        nationSex={sex.value}
                        title={sex.team}
                        fields={[
                          { format: sex.relay, label: "Relais" },
                          { format: "meilleure_nation", label: "Meilleure nation" },
                        ]}
                        odds={nationOdds.get(`${nation.code}|${sex.value}`) ?? {}}
                      />

                      {members.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-text-dim">
                                <th className="w-48 px-2 py-1 font-normal">Athlète</th>
                                {ATHLETE_FORMATS.map((f) => (
                                  <th key={f.format} className="px-1 py-1 font-normal">
                                    {f.label}
                                  </th>
                                ))}
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {members.map((athlete) => {
                                const formId = `odds-${athlete.id}`;
                                const current = athleteOdds.get(athlete.id) ?? {};
                                const hasOdds = Object.keys(current).length > 0;
                                return (
                                  <tr key={athlete.id} className="border-t border-border/40">
                                    <td className={`whitespace-nowrap px-2 py-1 ${hasOdds ? "" : "text-text-dim"}`}>
                                      <form id={formId} action={updateOddsRow}>
                                        <input type="hidden" name="season_id" value={season.id} />
                                        <input type="hidden" name="athlete_id" value={athlete.id} />
                                      </form>
                                      {athlete.first_name} {athlete.last_name}
                                      {!hasOdds && <span className="ml-1 text-[11px]">(sans cote)</span>}
                                    </td>
                                    {ATHLETE_FORMATS.map((f) => (
                                      <td key={f.format} className="px-1 py-1">
                                        <input
                                          form={formId}
                                          name={`odds_${f.format}`}
                                          type="number"
                                          min={1}
                                          defaultValue={current[f.format] ?? ""}
                                          className={oddsInputClass}
                                        />
                                      </td>
                                    ))}
                                    <td className="px-1 py-1">
                                      <button form={formId} type="submit" className="rounded border border-border px-2 py-1 text-xs">
                                        OK
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="px-3 text-xs text-text-dim">Aucun athlète.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}

        {shownNations.length === 0 && (
          <p className="text-sm text-text-dim">Aucun athlète ni cote pour cette saison : importe le CSV des cotes.</p>
        )}
      </div>
    </div>
  );
}
