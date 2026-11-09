import { describe, expect, it } from "vitest";
import { isPredictionOpen, predictionOpensAt, predictionOpensOn } from "../predictionWindow";

describe("ouverture des pronostics d'une étape", () => {
  it("le lundi qui précède l'étape", () => {
    // Étape du jeudi 26/11/2026 → lundi 23/11.
    expect(predictionOpensOn("2026-11-26")).toBe("2026-11-23");
    // Samedi 09/01/2027 → lundi 04/01.
    expect(predictionOpensOn("2027-01-09")).toBe("2027-01-04");
    // Mardi → la veille.
    expect(predictionOpensOn("2027-01-12")).toBe("2027-01-11");
    // Étape qui commence un lundi → le lundi d'avant.
    expect(predictionOpensOn("2027-01-11")).toBe("2027-01-04");
  });

  it("à 17 h heure de Paris, heure d'hiver comme d'été", () => {
    expect(predictionOpensAt("2026-11-26").toISOString()).toBe("2026-11-23T16:00:00.000Z");
    expect(predictionOpensAt("2027-03-26").toISOString()).toBe("2027-03-22T16:00:00.000Z");
    expect(predictionOpensAt("2027-04-02").toISOString()).toBe("2027-03-29T15:00:00.000Z");
    expect(isPredictionOpen("2026-11-26", new Date("2026-11-23T15:59:00Z"))).toBe(false);
    expect(isPredictionOpen("2026-11-26", new Date("2026-11-23T16:00:00Z"))).toBe(true);
  });

  it("date forcée dans l'admin : ce jour-là à 17 h", () => {
    expect(predictionOpensOn("2026-11-28", "2026-11-09")).toBe("2026-11-09");
    expect(isPredictionOpen("2026-11-28", new Date("2026-11-09T16:30:00Z"), "2026-11-09")).toBe(true);
    expect(isPredictionOpen("2026-11-28", new Date("2026-11-09T15:30:00Z"), "2026-11-09")).toBe(false);
    expect(isPredictionOpen("2026-11-28", new Date("2026-11-09T16:30:00Z"), null)).toBe(false);
  });
});
