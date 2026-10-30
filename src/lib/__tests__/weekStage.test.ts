import { describe, expect, it } from "vitest";
import { addDays, parisDay, pickWeekFeature } from "../weekStage";

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

  it("course en cours : badge « En ce moment »", () => {
    const now = new Date("2026-11-29T12:00:00Z");
    expect(pickWeekFeature(races, now)).toEqual({ badge: "now", ongoingIds: ["b"], resultRaceId: null, nextRaceId: null });
  });

  it("avant le départ : « Prochaine course » avec la première course à venir", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect(pickWeekFeature(races.slice(1), now)).toEqual({ badge: "next", ongoingIds: [], resultRaceId: null, nextRaceId: "b" });
  });

  it("résultat du jour gardé jusqu'à minuit, puis prochaine course", () => {
    const day = [race("b", "2026-11-29T11:00:00Z", "finished"), race("c", "2026-11-29T14:00:00Z"), race("d", "2026-11-30T14:00:00Z")];
    // 13h30 à Paris : la course b est notée aujourd'hui, la c pas encore partie.
    expect(pickWeekFeature(day, new Date("2026-11-29T12:30:00Z")).resultRaceId).toBe("b");
    // La 2e course part : elle chasse le résultat.
    expect(pickWeekFeature(day, new Date("2026-11-29T14:30:00Z")).ongoingIds).toEqual(["c"]);
    // Elle est notée : son résultat prend la place.
    const both = [day[0], { ...day[1], status: "finished" }, day[2]];
    expect(pickWeekFeature(both, new Date("2026-11-29T22:50:00Z")).resultRaceId).toBe("c");
    // Minuit à Paris (23h UTC) : on repart sur la prochaine course.
    expect(pickWeekFeature(both, new Date("2026-11-29T23:00:00Z"))).toEqual({ badge: "next", ongoingIds: [], resultRaceId: null, nextRaceId: "d" });
  });

  it("étape terminée : rien à mettre en avant", () => {
    const done = [race("a", "2026-11-28T13:00:00Z", "finished")];
    expect(pickWeekFeature(done, new Date("2026-11-30T12:00:00Z"))).toEqual({ badge: null, ongoingIds: [], resultRaceId: null, nextRaceId: null });
  });
});
