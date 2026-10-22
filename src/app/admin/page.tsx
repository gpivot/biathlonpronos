import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { CALENDAR_CSV_HEADERS } from "@/lib/admin/calendarImport";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { getClock } from "@/lib/clock";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { CsvImportPanel } from "./_components/CsvImportPanel";
import { ConfirmButton } from "./_components/ConfirmButton";
import { GlobesSection } from "./_globes/GlobesSection";
import {
  RACE_FORMATS,
  RACE_STATUS_LABELS,
  RACE_STATUS_STYLES,
  SPECIAL_RULES,
  formatDateRange,
  formatLockTime,
  raceLabel,
} from "./_components/labels";
import {
  activateSeason,
  createRace,
  createSeason,
  createStage,
  importCalendar,
  removeSeason,
  removeStage,
} from "./calendrier/actions";
import { removeRace } from "./races/[raceId]/actions";

export const dynamic = "force-dynamic";

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";
const trashClass =
  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-red/40 text-red hover:bg-red/10";

/** Calendrier & résultats : saisons (et leurs globes), étapes et courses de la saison active. */
export default async function AdminCalendarResultsPage() {
  const admin = createAdminClient();
  const { now } = await getClock();
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

  const sortedStages = (stages ?? []).map((stage: any) => ({
    ...stage,
    races: [...(stage.races ?? [])]
      .sort((a: any, b: any) => new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime())
      .map((race: any) => ({ ...race, displayStatus: getRaceDisplayStatus(race, now) })),
  }));
  // Comme le Calendrier joueur : ouverte par défaut, la première étape dont une course reste à saisir.
  const defaultOpenId = sortedStages.find((s) => s.races.some((r: any) => r.status !== "finished"))?.id;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Saisons</h1>

        <div className="flex flex-col gap-2">
          {(seasons ?? []).map((s) => (
            <details key={s.id} className="rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-text-dim">
                    {s.starts_on} → {s.ends_on} · globes de saison
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  <form action={removeSeason}>
                    <input type="hidden" name="season_id" value={s.id} />
                    <ConfirmButton
                      title="Supprimer la saison"
                      requireText={s.label}
                      message={`Supprimer la saison ${s.label} ? Tout ce qui en dépend sera définitivement effacé : étapes, courses, athlètes, cotes, pronostics, résultats, points, classements, ligues, cartes et Pépites.`}
                      className={trashClass}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </ConfirmButton>
                  </form>
                </div>
              </summary>
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-text-dim">
                  Globes de saison : saisis le classement final officiel (jusqu&apos;à 5 rangs) de chaque catégorie
                  en fin de saison pour noter les pronostics de saison des joueurs. Les athlètes et nations proposés
                  sont ceux qui ont une cote globe, jeune ou meilleure nation.
                </p>
                <GlobesSection admin={admin} seasonId={s.id} />
              </div>
            </details>
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
        <p className="text-sm text-text-dim">Active une saison pour gérer ses étapes, ses courses et leurs résultats.</p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Étapes & courses — {season.label}</h2>

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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-dim">
                        {done}/{stage.races.length} résultat(s) saisi(s)
                      </span>
                      <form action={removeStage}>
                        <input type="hidden" name="stage_id" value={stage.id} />
                        <ConfirmButton
                          title="Supprimer l'étape"
                          message={`Supprimer l'étape ${stage.location} et ses ${stage.races.length} course(s) ? Leurs pronostics, résultats et points seront effacés.`}
                          className={trashClass}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </ConfirmButton>
                      </form>
                    </div>
                  </summary>

                  <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
                    {stage.races.map((race: any) => (
                      <div key={race.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-bg">
                        <Link href={`/admin/races/${race.id}`} className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {raceLabel(race)}
                            {race.special_rule && (
                              <span className="ml-2 text-xs font-normal text-gold">
                                {SPECIAL_RULES.find((r) => r.value === race.special_rule)?.label}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-dim">{formatLockTime(race.locks_at)}</div>
                        </Link>
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${RACE_STATUS_STYLES[race.displayStatus]}`}
                        >
                          {RACE_STATUS_LABELS[race.displayStatus]}
                        </span>
                        <Link
                          href={`/admin/races/${race.id}`}
                          title="Modifier la course et saisir les résultats"
                          aria-label="Modifier la course et saisir les résultats"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-dim hover:text-ice"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                        <form action={removeRace}>
                          <input type="hidden" name="race_id" value={race.id} />
                          <ConfirmButton
                            title="Supprimer la course"
                            message={`Supprimer ${raceLabel(race)} (${stage.location}) ? Ses pronostics, résultats et points seront effacés.`}
                            className={trashClass}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </ConfirmButton>
                        </form>
                      </div>
                    ))}
                    {stage.races.length === 0 && <p className="px-2 text-xs text-text-dim">Aucune course pour cette étape.</p>}

                    <form action={createRace} className="mt-2 flex flex-wrap gap-2 border-t border-border/50 px-2 pt-3">
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

            {sortedStages.length === 0 && (
              <p className="text-sm text-text-dim">Aucune étape pour cette saison : importe le calendrier ou crée une étape.</p>
            )}
          </div>

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
        </section>
      )}
    </div>
  );
}
