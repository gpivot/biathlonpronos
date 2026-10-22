"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetSimulatedClock, setSimulatedClock } from "./actions";
import { DISPLAY_TIME_ZONE, fromParisWallTime, toParisWallTime } from "@/lib/displayTimeZone";

export interface ClockRaceOption {
  id: string;
  locksAt: string;
  label: string;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("fr-FR", { timeZone: DISPLAY_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ClockForm({ simulated, nowIso, races }: { simulated: boolean; nowIso: string; races: ClockRaceOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = new Date(nowIso);
  const [dateValue, setDateValue] = useState(() => toParisWallTime(now));
  const [raceId, setRaceId] = useState(() => races.find((r) => new Date(r.locksAt) > now)?.id ?? races[0]?.id ?? "");

  const apply = (targetMs: number) =>
    startTransition(async () => {
      await setSimulatedClock(targetMs);
      router.refresh();
    });

  const reset = () =>
    startTransition(async () => {
      await resetSimulatedClock();
      router.refresh();
    });

  const selectedRace = races.find((r) => r.id === raceId);

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          simulated ? "border-gold/50 bg-gold-soft text-gold" : "border-border bg-card text-text-dim"
        }`}
      >
        {simulated ? "Simulation active" : "Heure réelle"} : <strong>{formatDateTime(now)}</strong>
      </div>

      <form
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const target = fromParisWallTime(dateValue);
          if (!Number.isNaN(target.getTime())) apply(target.getTime());
        }}
      >
        <label className="text-sm font-semibold" htmlFor="sim-date">
          Aller à une date et heure (heure de Paris)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="sim-date"
            type="datetime-local"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pending} className="rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-on-ice">
            Appliquer
          </button>
        </div>
      </form>

      {races.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <label className="text-sm font-semibold" htmlFor="sim-race">
            Se placer autour du départ d&apos;une course
          </label>
          <select
            id="sim-race"
            value={raceId}
            onChange={(event) => setRaceId(event.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          >
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {formatDateTime(new Date(race.locksAt))} · {race.label}
              </option>
            ))}
          </select>
          {selectedRace && (
            <div className="flex flex-wrap gap-2">
              {[
                { label: "La veille à 20 h", target: eveBefore(selectedRace.locksAt) },
                { label: "5 min avant le départ", target: new Date(selectedRace.locksAt).getTime() - 5 * 60_000 },
                { label: "5 min après le départ", target: new Date(selectedRace.locksAt).getTime() + 5 * 60_000 },
              ].map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  disabled={pending}
                  onClick={() => apply(shortcut.target)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-frost hover:border-ice"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { label: "+1 h", ms: 3600_000 },
          { label: "+1 jour", ms: 24 * 3600_000 },
          { label: "+1 semaine", ms: 7 * 24 * 3600_000 },
        ].map((step) => (
          <button
            key={step.label}
            type="button"
            disabled={pending}
            onClick={() => apply(now.getTime() + step.ms)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-frost hover:border-ice"
          >
            {step.label}
          </button>
        ))}
        {simulated && (
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="rounded-lg border border-gold/50 px-3 py-2 text-sm font-semibold text-gold"
          >
            Revenir à l&apos;heure réelle
          </button>
        )}
      </div>
    </div>
  );
}

function eveBefore(locksAt: string) {
  const dayBefore = new Date(new Date(locksAt).getTime() - 24 * 3600_000);
  return fromParisWallTime(`${toParisWallTime(dayBefore).slice(0, 10)}T20:00`).getTime();
}
