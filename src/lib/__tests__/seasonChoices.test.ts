import { describe, expect, it } from "vitest";
import { seasonChoicesEditable } from "../seasonChoices";

describe("seasonChoicesEditable", () => {
  const firstRace = new Date("2026-11-29T12:15:00Z");

  it("est modifiable avant le départ de la 1re course de Coupe du Monde", () => {
    expect(seasonChoicesEditable(firstRace, new Date("2026-11-29T12:14:59Z"))).toBe(true);
  });

  it("est verrouillé dès le départ", () => {
    expect(seasonChoicesEditable(firstRace, new Date("2026-11-29T12:15:00Z"))).toBe(false);
    expect(seasonChoicesEditable(firstRace, new Date("2026-12-05T10:00:00Z"))).toBe(false);
  });

  it("reste modifiable tant qu'aucune course n'est au calendrier", () => {
    expect(seasonChoicesEditable(null, new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });
});
