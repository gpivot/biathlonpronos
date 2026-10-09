"use client";

import { useState } from "react";
import { submitResults, type SubmitResultsState } from "./actions";
import type { ResultEntryInput } from "@/lib/admin/raceResults";

export interface CandidateRow {
  id: string;
  name: string;
  subtitle: string;
  odds: number;
  existingResult?: {
    rank: number | null;
    timeGapSeconds: number | null;
    penaltyLaps: number;
    isFusee: boolean;
    isGachette: boolean;
  };
}

interface RowState {
  rank: string;
  timeGapSeconds: string;
  penaltyLaps: string;
  isFusee: boolean;
  isGachette: boolean;
}

function initialRowState(candidate: CandidateRow): RowState {
  const r = candidate.existingResult;
  return {
    rank: r?.rank != null ? String(r.rank) : "",
    timeGapSeconds: r?.timeGapSeconds != null ? String(r.timeGapSeconds) : "",
    penaltyLaps: r?.penaltyLaps ? String(r.penaltyLaps) : "",
    isFusee: r?.isFusee ?? false,
    isGachette: r?.isGachette ?? false,
  };
}

export function ResultsForm({
  raceId,
  mode,
  format,
  specialRule,
  candidates,
}: {
  raceId: string;
  mode: "athlete" | "nation";
  format: string;
  specialRule: string | null;
  candidates: CandidateRow[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(candidates.map((c) => [c.id, initialRowState(c)]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResultsState | null>(null);

  const isAthleteMode = mode === "athlete";
  const showTimeGap = isAthleteMode && format === "sprint";
  const showPenaltyLaps = isAthleteMode && specialRule === "tour_de_pena";

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const entries: ResultEntryInput[] = Object.entries(rows)
      .filter(([, row]) => row.rank.trim() !== "")
      .map(([id, row]) => ({
        athleteId: isAthleteMode ? id : undefined,
        nationCode: isAthleteMode ? undefined : id,
        rank: Number(row.rank),
        timeGapSeconds: row.timeGapSeconds.trim() !== "" ? Number(row.timeGapSeconds) : undefined,
        penaltyLaps: row.penaltyLaps.trim() !== "" ? Number(row.penaltyLaps) : undefined,
        isFusee: row.isFusee,
        isGachette: row.isGachette,
      }));

    const outcome = await submitResults(raceId, entries);
    setSubmitting(false);
    setResult(outcome);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-dim">
              <th className="px-3 py-2">{isAthleteMode ? "Athlète" : "Nation"}</th>
              <th className="px-3 py-2">Cote</th>
              <th className="px-3 py-2">Rang</th>
              {showTimeGap && <th className="px-3 py-2">Écart (s)</th>}
              {showPenaltyLaps && <th className="px-3 py-2">Tours de péna</th>}
              {isAthleteMode && <th className="px-3 py-2">Fusée</th>}
              {isAthleteMode && <th className="px-3 py-2">Gâchette</th>}
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const row = rows[candidate.id];
              return (
                <tr key={candidate.id} className="border-b border-border/50">
                  <td className="px-3 py-2">
                    {candidate.name} <span className="text-text-dim">({candidate.subtitle})</span>
                  </td>
                  <td className="px-3 py-2 text-text-dim">×{candidate.odds}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={row.rank}
                      onChange={(e) => updateRow(candidate.id, { rank: e.target.value })}
                      className="w-16 rounded border border-border bg-card px-2 py-1"
                    />
                  </td>
                  {showTimeGap && (
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.timeGapSeconds}
                        onChange={(e) => updateRow(candidate.id, { timeGapSeconds: e.target.value })}
                        className="w-20 rounded border border-border bg-card px-2 py-1"
                      />
                    </td>
                  )}
                  {showPenaltyLaps && (
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.penaltyLaps}
                        onChange={(e) => updateRow(candidate.id, { penaltyLaps: e.target.value })}
                        className="w-16 rounded border border-border bg-card px-2 py-1"
                      />
                    </td>
                  )}
                  {isAthleteMode && (
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.isFusee}
                        onChange={(e) => updateRow(candidate.id, { isFusee: e.target.checked })}
                      />
                    </td>
                  )}
                  {isAthleteMode && (
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.isGachette}
                        onChange={(e) => updateRow(candidate.id, { isGachette: e.target.checked })}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result && (
        <div className={result.status === "error" ? "text-sm text-red" : "text-sm text-ice"}>
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-xl bg-ice px-5 py-2.5 text-sm font-bold text-[#062024] disabled:opacity-60"
      >
        {submitting ? "Calcul en cours..." : "Enregistrer et calculer les scores"}
      </button>
    </form>
  );
}
