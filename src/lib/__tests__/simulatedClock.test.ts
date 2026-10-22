import { describe, expect, it } from "vitest";
import { applyClockOffset, parseClockOffset } from "../simulatedClock";
import { getRaceDisplayStatus } from "../raceStatus";

describe("parseClockOffset", () => {
  it("accepte un décalage entier en millisecondes", () => {
    expect(parseClockOffset("3600000")).toBe(3_600_000);
    expect(parseClockOffset("-86400000")).toBe(-86_400_000);
  });

  it("ignore les valeurs absentes, nulles ou invalides", () => {
    expect(parseClockOffset(undefined)).toBeNull();
    expect(parseClockOffset("")).toBeNull();
    expect(parseClockOffset("0")).toBeNull();
    expect(parseClockOffset("12abc")).toBeNull();
    expect(parseClockOffset("1.5")).toBeNull();
  });

  it("refuse un décalage de plus de deux ans", () => {
    expect(parseClockOffset(String(3 * 365 * 24 * 3600 * 1000))).toBeNull();
  });
});

describe("applyClockOffset", () => {
  const realNow = new Date("2026-10-22T15:00:00Z");

  it("renvoie l'heure réelle sans décalage", () => {
    expect(applyClockOffset(null, realNow)).toBe(realNow);
  });

  it("décale l'heure réelle", () => {
    expect(applyClockOffset(2 * 3600 * 1000, realNow).toISOString()).toBe("2026-10-22T17:00:00.000Z");
  });
});

describe("getRaceDisplayStatus avec une horloge donnée", () => {
  const race = { status: "upcoming" as const, locks_at: "2026-11-29T12:15:00Z" };

  it("course à venir avant l'heure de verrouillage", () => {
    expect(getRaceDisplayStatus(race, new Date("2026-11-29T12:14:00Z"))).toBe("upcoming");
  });

  it("course en cours dès l'heure de verrouillage", () => {
    expect(getRaceDisplayStatus(race, new Date("2026-11-29T12:15:00Z"))).toBe("ongoing");
  });

  it("course terminée quel que soit l'horloge", () => {
    expect(getRaceDisplayStatus({ ...race, status: "finished" }, new Date("2026-01-01T00:00:00Z"))).toBe("finished");
  });
});
