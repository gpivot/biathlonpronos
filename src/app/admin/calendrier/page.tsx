import { createAdminClient } from "@/lib/supabase/server";
import { CALENDAR_CSV_HEADERS } from "@/lib/admin/calendarImport";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { CsvImportPanel } from "../_components/CsvImportPanel";
import {
  RACE_FORMATS,
  RACE_STATUS_LABELS,
  RACE_STATUS_STYLES,
  SPECIAL_RULES,
  formatDateRange,
  formatLockTime,
  raceLabel,
} from "../_components/labels";
import { activateSeason, createRace, createSeason, createStage, importCalendar } from "./actions";

export const dynamic = "force-dynamic";

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";

export default async function AdminCalendarPage() {
  const admin = createAdminClient();
  const { data: seasons } = await admin.from("seasons").select("*").order("starts_on", { ascending: false });
  const season = (seasons ?? []).find((s) => s.status === "active");

  const [{ data: nations }, { data: stages }] = await Promise.all([
    admin.from("nations").select("*").order("name"),
    season
      ? admin
          .from("stages")
          .select("*, races(id, format, sex, locks_at, special_rule, status)")
          .eq("season_id", season.id)
          .order("starts_on")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Saisons</h1>

        <div className="flex flex-col gap-2">
          {(seasons ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{s.label}</div>
                <div className="text-xs text-text-dim">
                  {s.starts_on} → {s.ends_on}
                </div>
              </div>
              {s.status === "active" ? (
                <span className="rounded-full bg-ice-soft px-3 py-1 text-xs font-semibold text-ice">active</span>
              ) : (
                <form action={activateSeason}>
                  <input type="hidden" name="season_id" value={s.id} />
                  <button type="submit" className="rounded border border-border px-3 py-1 text-xs">
                    Activer
                  </button>
                </form>
              )}
            </div>
          ))}
          {(!seasons || seasons.length === 0) && (
            <p className="text-sm text-text-dim">Aucune saison. Crée-en une ci-dessous pour commencer.</p>
          )}
        </div>

        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-xs font-semibold text-text-dim">Nouvelle saison</summary>
          <form action={createSeason} className="mt-3 flex flex-wrap gap-2">
            <input name="label" required placeholder="Label (ex. 2026-27)" className={inputClass} />
            <input name="starts_on" type="date" required className={inputClass} />
            <input name="ends_on" type="date" required className={inputClass} />
            <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
              Créer
            </button>
          </form>
        </details>
      </section>

      {!season ? (
        <p className="text-sm text-text-dim">Active une saison pour gérer ses étapes et ses courses.</p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Étapes & courses — {season.label}</h2>

          <CsvImportPanel
            title="Calendrier en CSV"
            description={
              <>
                Une ligne par course ; les courses d&apos;un même lieu forment une étape (×2 si la catégorie
                contient « Championnats » ou « JO »). Pays en code à 2 lettres (FR, NO…), date AAAA-MM-JJ,
                heure HH:MM en UTC, type Sprint / Poursuite / Individuel / Mass-start / Relais / Relais
                mixte / Relais mixte simple, sexe Femmes / Hommes / Mixte. Réimportable : les étapes et
                courses existantes sont mises à jour (heure), rien n&apos;est supprimé.
              </>
            }
            headers={CALENDAR_CSV_HEADERS}
            downloadHref="/admin/calendrier/export"
            onImport={importCalendar.bind(null, season.id)}
          />

          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-xs font-semibold text-text-dim">Nouvelle étape</summary>
            <form action={createStage} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="season_id" value={season.id} />
              <input name="location" required placeholder="Lieu (ex. Kontiolahti)" className={inputClass} />
              <select name="country_code" required className={inputClass}>
                {(nations ?? []).map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.name} ({n.code})
                  </option>
                ))}
              </select>
              <input name="starts_on" type="date" required className={inputClass} />
              <input name="ends_on" type="date" required className={inputClass} />
              <select name="coefficient" className={inputClass}>
                <option value="1">Coupe du Monde (×1)</option>
                <option value="2">Mondiaux / JO (×2)</option>
              </select>
              <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
                Créer
              </button>
            </form>
          </details>

          <div className="flex flex-col gap-2">
            {(stages ?? []).map((stage: any) => {
              const races = [...(stage.races ?? [])].sort(
                (a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime()
              );
              return (
                <details key={stage.id} className="rounded-xl border border-border bg-card">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {nationFlagEmoji(stage.country_code)} {stage.location}
                      </div>
                      <div className="text-xs text-text-dim">
                        {formatDateRange(stage.starts_on, stage.ends_on)} · {races.length} course(s)
                      </div>
                    </div>
                    {stage.coefficient === 2 && (
                      <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold">×2</span>
                    )}
                  </summary>

                  <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                    {races.map((race: any) => (
                      <div key={race.id} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-semibold">{raceLabel(race)}</span>
                          {race.special_rule && (
                            <span className="ml-2 text-xs text-gold">
                              {SPECIAL_RULES.find((r) => r.value === race.special_rule)?.label}
                            </span>
                          )}
                          <div className="text-xs text-text-dim">{formatLockTime(race.locks_at)}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RACE_STATUS_STYLES[race.status] ?? ""}`}>
                          {RACE_STATUS_LABELS[race.status] ?? race.status}
                        </span>
                      </div>
                    ))}
                    {races.length === 0 && <p className="text-xs text-text-dim">Aucune course pour cette étape.</p>}

                    <form action={createRace} className="mt-2 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                      <input type="hidden" name="stage_id" value={stage.id} />
                      <select name="format" required className={inputClass}>
                        {RACE_FORMATS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select name="sex" className={inputClass}>
                        <option value="F">Femmes</option>
                        <option value="H">Hommes</option>
                        <option value="">— (relais)</option>
                      </select>
                      <input
                        name="locks_at"
                        type="datetime-local"
                        required
                        title="Heure de départ (= verrouillage), en UTC"
                        className={inputClass}
                      />
                      <select name="special_rule" className={inputClass}>
                        {SPECIAL_RULES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="rounded border border-border px-3 py-1.5 text-xs">
                        Ajouter la course
                      </button>
                    </form>
                  </div>
                </details>
              );
            })}

            {(!stages || stages.length === 0) && (
              <p className="text-sm text-text-dim">Aucune étape pour cette saison : importe le calendrier ou crée une étape.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
