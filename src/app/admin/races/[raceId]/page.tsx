import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ResultsForm, type CandidateRow } from "./ResultsForm";
import { SpecialRuleSelect } from "../../_components/SpecialRuleSelect";
import {
  RACE_FORMATS,
  RACE_STATUS_LABELS,
  RACE_STATUS_STYLES,
  RELAY_FORMATS,
  SPECIAL_RULES,
  raceLabel,
  toDateTimeLocalUtc,
} from "../../_components/labels";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { getRaceDisplayStatus } from "@/lib/raceStatus";
import { getClock } from "@/lib/clock";
import { removeRace, resetResults, updateRace } from "./actions";
import { ArrowLeftIcon } from "@/components/icons";

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";

export const dynamic = "force-dynamic";

export default async function AdminRacePage({ params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const admin = createAdminClient();

  const { data: race } = await admin
    .from("races")
    .select("*, stages(location, season_id)")
    .eq("id", raceId)
    .single();
  if (!race) notFound();

  const stage = race.stages as { location: string; season_id: string };
  const isRelay = RELAY_FORMATS.includes(race.format);

  const { data: existingResults } = await admin.from("race_results").select("*").eq("race_id", raceId);

  let candidates: CandidateRow[];

  if (isRelay) {
    const resultByNationCode = new Map((existingResults ?? []).map((r) => [r.nation_code, r]));

    const { data: odds } = await admin
      .from("odds")
      .select("nation_code, value, nations(name)")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null);

    candidates = (odds ?? [])
      .map((o: any) => {
        const existing = resultByNationCode.get(o.nation_code);
        return {
          id: o.nation_code,
          name: o.nations?.name ?? o.nation_code,
          subtitle: o.nation_code,
          nationCode: o.nation_code,
          nationName: o.nations?.name ?? undefined,
          odds: o.value,
          existingResult: existing
            ? {
                rank: existing.rank,
                timeGapSeconds: existing.time_gap_seconds,
                penaltyLaps: existing.penalty_laps,
                isFusee: existing.is_fusee,
                isGachette: existing.is_gachette,
              }
            : undefined,
        };
      })
      .sort((a, b) => a.odds - b.odds);
  } else {
    const resultByAthleteId = new Map((existingResults ?? []).map((r) => [r.athlete_id, r]));

    const { data: odds } = await admin
      .from("odds")
      .select("athlete_id, value, athletes(first_name, last_name, nation_code, sex)")
      .eq("season_id", stage.season_id)
      .eq("format", race.format)
      .is("valid_until", null);

    candidates = (odds ?? [])
      .filter((o: any) => !race.sex || o.athletes?.sex === race.sex)
      .map((o: any) => {
        const existing = resultByAthleteId.get(o.athlete_id);
        return {
          id: o.athlete_id,
          name: `${o.athletes?.first_name ?? ""} ${o.athletes?.last_name ?? ""}`.trim(),
          subtitle: o.athletes?.nation_code ?? "",
          firstName: o.athletes?.first_name ?? "",
          lastName: o.athletes?.last_name ?? "",
          nationCode: o.athletes?.nation_code ?? "",
          odds: o.value,
          existingResult: existing
            ? {
                rank: existing.rank,
                timeGapSeconds: existing.time_gap_seconds,
                penaltyLaps: existing.penalty_laps,
                isFusee: existing.is_fusee,
                isGachette: existing.is_gachette,
              }
            : undefined,
        };
      })
      .sort((a, b) => a.odds - b.odds);
  }

  const { now } = await getClock();
  const displayStatus = getRaceDisplayStatus(race, now);
  const hasResults = (existingResults ?? []).length > 0 || race.status === "finished";

  return (
    <div className="flex flex-col gap-4">
      <BackLinks raceId={race.id} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          {raceLabel(race)} — {stage.location}
        </h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RACE_STATUS_STYLES[displayStatus]}`}>
          {RACE_STATUS_LABELS[displayStatus]}
        </span>
      </div>

      <form action={updateRace} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Infos de la course</div>
        <input type="hidden" name="race_id" value={race.id} />
        <div className="flex flex-wrap gap-2">
          <select name="format" defaultValue={race.format} className={inputClass}>
            {RACE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select name="sex" defaultValue={race.sex ?? ""} className={inputClass}>
            <option value="F">Femmes</option>
            <option value="H">Hommes</option>
            <option value="">— (relais)</option>
          </select>
          <input
            name="locks_at"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocalUtc(race.locks_at)}
            title="Heure de départ (= verrouillage), en UTC"
            className={inputClass}
          />
          <SpecialRuleSelect defaultValue={race.special_rule ?? ""} defaultFormat={race.format} className={inputClass} />
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
            Enregistrer
          </button>
        </div>
        <p className="text-xs text-text-dim">Heure de départ en UTC : c&apos;est aussi l&apos;heure de verrouillage des pronostics.</p>
      </form>

      {candidates.length === 0 ? (
        <p className="text-sm text-text-dim">
          Aucune cote saisie pour ce format (voir Athlètes & cotes) —
          impossible de noter la course.
        </p>
      ) : (
        <ResultsForm
          key={`${race.status}-${(existingResults ?? []).length}`}
          raceId={raceId}
          mode={isRelay ? "nation" : "athlete"}
          format={race.format}
          specialRule={race.special_rule}
          candidates={candidates}
        />
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {hasResults && (
          <form action={resetResults}>
            <input type="hidden" name="race_id" value={race.id} />
            <ConfirmButton
              message="Réinitialiser les résultats de cette course ? Les résultats saisis et les points des joueurs sur cette course seront effacés."
              className="rounded border border-gold/60 px-4 py-1.5 text-sm text-gold hover:bg-gold/10"
            >
              Réinitialiser les résultats
            </ConfirmButton>
          </form>
        )}
        <form action={removeRace}>
          <input type="hidden" name="race_id" value={race.id} />
          <input type="hidden" name="redirect" value="1" />
          <ConfirmButton
            message="Supprimer cette course ? Ses pronostics, résultats et points seront effacés."
            className="rounded border border-red/50 px-4 py-1.5 text-sm text-red hover:bg-red/10"
          >
            Supprimer la course
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}

function BackLinks({ raceId }: { raceId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Page publique de la course : classement et points une fois la course notée. */}
      <Link
        href={`/courses/${raceId}`}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-frost hover:text-ice"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Voir la course et son classement
      </Link>
      <Link href="/admin" className="text-sm text-text-dim underline">
        Retour au calendrier
      </Link>
    </div>
  );
}
