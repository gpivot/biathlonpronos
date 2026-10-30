import { describe, expect, it } from "vitest";
import { isPredictionOpen, predictionOpensOn } from "../predictionWindow";

describe("ouverture des pronostics d'une étape", () => {
  it("7 jours avant le premier jour, à minuit heure de Paris", () => {
    expect(predictionOpensOn("2027-01-09")).toBe("2027-01-02");
    expect(isPredictionOpen("2027-01-09", new Date("2027-01-01T22:59:00Z"))).toBe(false);
    expect(isPredictionOpen("2027-01-09", new Date("2027-01-01T23:00:00Z"))).toBe(true);
  });
});
