import { describe, expect, it } from "vitest";
import { computeIndividualPickPoints, computeIndividualExtras, computeResultRowPoints } from "../lastResult";
import { computeIndividualRaceScore } from "../scoring";
import type { IndividualRaceScoringInput } from "../scoring";

const results = [
  { athleteId: "a", rank: 1, isFusee: true },
  { athleteId: "b", rank: 2, isGachette: true },
  { athleteId: "c", rank: 7 },
  { athleteId: "d", rank: 15 },
  { athleteId: "e", rank: 3 },
];

function baseInput(overrides: Partial<IndividualRaceScoringInput>): IndividualRaceScoringInput {
  return {
    predictedAthleteIds: ["a", "b", "c"],
    results,
    oddsByAthleteId: { a: 2, b: 5, c: 12, d: 20, e: 4 },
    athleteTeamByAthleteId: {
      a: { nationCode: "NOR", sex: "H" },
      b: { nationCode: "FRA", sex: "H" },
      c: { nationCode: "FRA", sex: "H" },
      d: { nationCode: "GER", sex: "H" },
      e: { nationCode: "SWE", sex: "H" },
    },
    specialRule: null,
    stageCoefficient: 1,
    bonusX2Active: false,
    card: { type: "none" },
    favoriteTeam: null,
    raceCountryCode: "FRA",
    ...overrides,
  };
}

/** Les points par athlète reconstitués depuis le breakdown doivent égaler ceux du moteur. */
function expectSameAsEngine(input: IndividualRaceScoringInput) {
  const engine = computeIndividualRaceScore(input);
  const rebuilt = computeIndividualPickPoints({
    athleteIds: input.predictedAthleteIds,
    breakdown: engine.breakdown,
    results: input.results.map((r) => ({ athlete_id: r.athleteId, is_fusee: !!r.isFusee, is_gachette: !!r.isGachette })),
    stageCoefficient: input.stageCoefficient,
    bonusX2: input.bonusX2Active,
    caFarteTargetId: input.card.type === "ca_farte" ? input.card.targetAthleteId : null,
  });
  for (const id of input.predictedAthleteIds) {
    expect(rebuilt[id]).toBe(id in engine.perAthlete ? engine.perAthlete[id] : null);
  }
  const extras = computeIndividualExtras(engine.breakdown).reduce((s, e) => s + e.points, 0);
  const picks = Object.values(rebuilt).reduce<number>((s, v) => s + (v ?? 0), 0);
  expect(picks + extras).toBe(engine.total);
}

describe("encart Dernier résultat : points par athlète", () => {
  it("course simple avec Fusée et Gâchette", () => expectSameAsEngine(baseInput({})));
  it("bonus ×2 personnel", () => expectSameAsEngine(baseInput({ bonusX2Active: true })));
  it("étape Mondiaux (coeff. ×2)", () => expectSameAsEngine(baseInput({ stageCoefficient: 2 })));
  it("carte Ça farte", () => expectSameAsEngine(baseInput({ bonusX2Active: true, card: { type: "ca_farte", targetAthleteId: "c" } })));
  it("Balle de pioche : le 4e choix ne compte pas", () =>
    expectSameAsEngine(baseInput({ predictedAthleteIds: ["a", "b", "c", "d"], card: { type: "balle_de_pioche" } })));
  it("Team Nation à domicile", () =>
    expectSameAsEngine(baseInput({ favoriteTeam: { nationCode: "FRA", sex: "H" } })));
  it("podium complet (bonus de combinaison)", () => expectSameAsEngine(baseInput({ predictedAthleteIds: ["a", "b", "e"] })));
});

describe("points du barème dans le classement d'une course", () => {
  it("cote × rang dans le Top 10, plus Fusée et Gâchette", () => {
    expect(computeResultRowPoints({ rank: 1, odds: 2, relay: false, isFusee: true, isGachette: true })).toBe(50 + 50 + 20);
    expect(computeResultRowPoints({ rank: 10, odds: 7, relay: false, isFusee: false, isGachette: false })).toBe(7);
  });

  it("rien au-delà du Top 10, sauf Fusée/Gâchette", () => {
    expect(computeResultRowPoints({ rank: 11, odds: 7, relay: false, isFusee: false, isGachette: false })).toBeNull();
    expect(computeResultRowPoints({ rank: 25, odds: 7, relay: false, isFusee: false, isGachette: true })).toBe(20);
  });

  it("relais : barème réduit, Top 5 seulement", () => {
    expect(computeResultRowPoints({ rank: 1, odds: 3, relay: true, isFusee: false, isGachette: false })).toBe(30);
    expect(computeResultRowPoints({ rank: 6, odds: 3, relay: true, isFusee: false, isGachette: false })).toBeNull();
  });
});
