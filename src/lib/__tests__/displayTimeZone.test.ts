import { describe, expect, it } from "vitest";
import { fromParisWallTime, toParisWallTime } from "../displayTimeZone";

describe("heure de Paris", () => {
  it("hiver : UTC+1", () => {
    expect(toParisWallTime(new Date("2026-11-26T14:10:00Z"))).toBe("2026-11-26T15:10");
    expect(fromParisWallTime("2026-11-26T15:10").toISOString()).toBe("2026-11-26T14:10:00.000Z");
  });

  it("été : UTC+2", () => {
    expect(toParisWallTime(new Date("2026-10-09T15:00:00Z"))).toBe("2026-10-09T17:00");
    expect(fromParisWallTime("2026-10-09T17:00").toISOString()).toBe("2026-10-09T15:00:00.000Z");
  });

  it("jour du passage à l'heure d'hiver", () => {
    expect(fromParisWallTime("2026-10-25T12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });
});
