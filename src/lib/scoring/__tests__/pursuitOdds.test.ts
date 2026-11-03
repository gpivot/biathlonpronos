import { describe, expect, it } from "vitest";
import { computePursuitOdds } from "../pursuitOdds";

// Exemples chiffrés de docs/reglement.md §4 (Lou, cote de base 10).
describe("computePursuitOdds", () => {
  it("laisse la cote inchangée sur la première tranche de 20s", () => {
    expect(computePursuitOdds(10, 12)).toBe(10);
  });

  it("ajoute 5 par tranche de 20s au-delà de la première", () => {
    expect(computePursuitOdds(10, 42)).toBe(20);
    expect(computePursuitOdds(10, 70)).toBe(25);
  });

  it("plafonne la cote à 50", () => {
    expect(computePursuitOdds(10, 1000)).toBe(50);
    expect(computePursuitOdds(40, 70)).toBe(50);
  });

  it("ne fait jamais baisser une cote de base", () => {
    expect(computePursuitOdds(50, 120)).toBe(50);
  });
});
