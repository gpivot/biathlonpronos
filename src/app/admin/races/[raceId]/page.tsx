import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ResultsForm, type CandidateRow } from "./ResultsForm";

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

const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

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

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <h1 className="text-xl font-bold">
        {FORMAT_LABELS[race.format] ?? race.format}
        {race.sex ? ` ${race.sex === "F" ? "Femmes" : "Hommes"}` : ""} — {stage.location}
      </h1>
      {race.special_rule && (
        <p className="text-sm text-gold">Course spéciale : {race.special_rule.replace(/_/g, " ")}</p>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-text-dim">
          Aucune cote saisie pour ce format ({isRelay ? "voir Admin > Cotes de relais" : "voir Admin > Athlètes & cotes"}) —
          impossible de noter la course.
        </p>
      ) : (
        <ResultsForm
          raceId={raceId}
          mode={isRelay ? "nation" : "athlete"}
          format={race.format}
          specialRule={race.special_rule}
          candidates={candidates}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin" className="text-sm text-text-dim underline">
      ← Retour à la liste des courses
    </Link>
  );
}
