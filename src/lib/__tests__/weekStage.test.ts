import { describe, expect, it } from "vitest";
import { addDays, parisDay, summarizeStageRaces } from "../weekStage";

const race = (id: string, locks_at: string, status = "upcoming") => ({ id, format: "sprint", sex: "M", locks_at, status });

describe("étape de la semaine", () => {
  it("jour de Paris, y compris tard le soir en UTC", () => {
    expect(parisDay(new Date("2026-11-28T23:30:00Z"))).toBe("2026-11-29");
    expect(addDays("2026-11-29", 7)).toBe("2026-12-06");
  });

  const races = [
    race("a", "2026-11-28T13:00:00Z", "finished"),
    race("b", "2026-11-29T11:00:00Z"),
    race("c", "2026-11-29T14:00:00Z"),
    race("d", "2026-11-30T14:00:00Z"),
  ];

  it("course en cours et badge du jour", () => {
    const now = new Date("2026-11-29T12:00:00Z");
    expect(summarizeStageRaces(races, now)).toEqual({ raceToday: true, ongoingIds: ["b"] });
  });

  it("pas de badge un jour sans course", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect(summarizeStageRaces(races, now)).toEqual({ raceToday: false, ongoingIds: [] });
  });
});
