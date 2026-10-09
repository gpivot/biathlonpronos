import { describe, expect, it } from "vitest";
import { computeAspirationBonus, computeIndividualRaceScore } from "../individualRace";
import type { AthleteRaceResult, IndividualRaceScoringInput } from "../types";

function baseInput(overrides: Partial<IndividualRaceScoringInput> = {}): IndividualRaceScoringInput {
  return {
    predictedAthleteIds: [],
    results: [],
    oddsByAthleteId: {},
    athleteTeamByAthleteId: {},
    specialRule: null,
    stageCoefficient: 1,
    bonusX2Active: false,
    card: { type: "none" },
    favoriteTeam: null,
    raceCountryCode: "FRA",
    ...overrides,
  };
}

describe("computeIndividualRaceScore — barème de base", () => {
  it("applique cote × multiplicateur de rang", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
      })
    );
    expect(result.breakdown.base.a).toBe(250); // cote 10 × 25
    expect(result.total).toBe(250);
  });

  it("ne rapporte rien hors Top 10 en temps normal", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 11 }],
        oddsByAthleteId: { a: 10 },
      })
    );
    expect(result.breakdown.base.a).toBe(0);
  });
});

describe("computeIndividualRaceScore — bonus de combinaison", () => {
  const athletes: AthleteRaceResult[] = [
    { athleteId: "a", rank: 1 },
    { athleteId: "b", rank: 2 },
    { athleteId: "c", rank: 3 },
  ];
  const odds = { a: 1, b: 1, c: 1 };

  it("bonus podium quand les 3 sont dans le Top 3", () => {
    const result = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["a", "b", "c"], results: athletes, oddsByAthleteId: odds })
    );
    expect(result.breakdown.combinationBonus).toBe(100);
  });

  it("bonus top5 (pas podium) quand le pire des 3 est 4e ou 5e", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b", "d"],
        results: [...athletes, { athleteId: "d", rank: 5 }],
        oddsByAthleteId: { ...odds, d: 1 },
      })
    );
    expect(result.breakdown.combinationBonus).toBe(50);
  });

  it("aucun bonus de combinaison si un des 3 est hors Top 10", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b", "z"],
        results: [...athletes, { athleteId: "z", rank: 15 }],
        oddsByAthleteId: { ...odds, z: 1 },
      })
    );
    expect(result.breakdown.combinationBonus).toBe(0);
  });
});

describe("computeIndividualRaceScore — prono parfait", () => {
  it("bonus de 200 quand le pronostic est la combinaison la plus rentable du Top 10", () => {
    const results: AthleteRaceResult[] = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
      { athleteId: "d", rank: 4 },
    ];
    // Cotes choisies pour que {a, c, d} rapporte plus que {a, b, c}.
    const odds = { a: 10, b: 1, c: 10, d: 10 };

    const result = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["a", "c", "d"], results, oddsByAthleteId: odds })
    );
    expect(result.breakdown.pronoParfaitBonus).toBe(200);

    const missed = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["a", "b", "c"], results, oddsByAthleteId: odds })
    );
    expect(missed.breakdown.pronoParfaitBonus).toBe(0);
  });
});

describe("computeIndividualRaceScore — courses spéciales", () => {
  it("tour de péna : -20 par tour, par athlète pronostiqué", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 5, penaltyLaps: 2 }],
        oddsByAthleteId: { a: 10 },
        specialRule: "tour_de_pena",
      })
    );
    expect(result.breakdown.base.a).toBe(70 - 40); // (7×10) - (2×20)
  });

  it("brouillard : malus égal au rang au-delà de la 10e place", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b"],
        results: [
          { athleteId: "a", rank: 13 },
          { athleteId: "b", rank: 48 },
        ],
        oddsByAthleteId: { a: 10, b: 10 },
        specialRule: "brouillard",
      })
    );
    expect(result.breakdown.base.a).toBe(-13);
    expect(result.breakdown.base.b).toBe(-48);
  });

  it("t'es collé(e) : malus croissant selon le nombre hors Top 10", () => {
    const results: AthleteRaceResult[] = [
      { athleteId: "a", rank: 1 },
      { athleteId: "e", rank: 2 },
      { athleteId: "b", rank: 15 },
      { athleteId: "c", rank: 20 },
    ];
    const odds = { a: 1, b: 1, c: 1, e: 1 };

    const oneOut = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["a", "e", "b"], results, oddsByAthleteId: odds, specialRule: "tes_colle" })
    );
    expect(oneOut.breakdown.specialMalus).toBe(-30);

    const twoOut = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["a", "b", "c"], results, oddsByAthleteId: odds, specialRule: "tes_colle" })
    );
    expect(twoOut.breakdown.specialMalus).toBe(-100);

    const threeOut = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: ["b", "c"], results, oddsByAthleteId: odds, specialRule: "tes_colle" })
    );
    expect(threeOut.breakdown.specialMalus).toBe(-300);

    const noBet = computeIndividualRaceScore(
      baseInput({ predictedAthleteIds: [], results, oddsByAthleteId: odds, specialRule: "tes_colle" })
    );
    expect(noBet.breakdown.specialMalus).toBe(-200);
  });
});

describe("computeIndividualRaceScore — Fusée & Gâchette", () => {
  it("bonus Fusée (une fois) et Gâchette (cumulable)", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b", "c"],
        results: [
          { athleteId: "a", rank: 1, isFusee: true },
          { athleteId: "b", rank: 2, isGachette: true },
          { athleteId: "c", rank: 3, isGachette: true },
        ],
        oddsByAthleteId: { a: 1, b: 1, c: 1 },
      })
    );
    expect(result.breakdown.fuseeGachetteBonus).toBe(50 + 20 + 20);
  });
});

describe("computeIndividualRaceScore — coefficients et cartes", () => {
  it("coefficient ×2 Mondiaux/JO double les points", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
        stageCoefficient: 2,
      })
    );
    expect(result.perAthlete.a).toBe(500);
  });

  it("bonus ×2 personnel et coefficient Mondiaux/JO ne se cumulent pas", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
        stageCoefficient: 2,
        bonusX2Active: true,
      })
    );
    expect(result.perAthlete.a).toBe(500); // ×2, pas ×4
  });

  it('carte "Ça farte" triple les points d\'un seul athlète', () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b"],
        results: [
          { athleteId: "a", rank: 1 },
          { athleteId: "b", rank: 1 },
        ],
        oddsByAthleteId: { a: 10, b: 10 },
        card: { type: "ca_farte", targetAthleteId: "a" },
      })
    );
    expect(result.perAthlete.a).toBe(750); // 250 × 3
    expect(result.perAthlete.b).toBe(250);
  });

  it('carte "Ça farte" (×3) n\'est jamais cumulable avec un ×2 (coefficient, bonus perso ou Team Nation)', () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
        stageCoefficient: 2, // ×2 Mondiaux/JO — ignoré pour l'athlète ciblé
        athleteTeamByAthleteId: { a: { nationCode: "FRA", sex: "F" } },
        favoriteTeam: { nationCode: "FRA", sex: "F" }, // Team Nation ×2 — ignoré aussi
        raceCountryCode: "FRA",
        card: { type: "ca_farte", targetAthleteId: "a" },
      })
    );
    expect(result.perAthlete.a).toBe(750); // 250 × 3, jamais × 6 ni × 9
    expect(result.breakdown.teamNationBoostedAthleteIds).toEqual([]);
  });

  it('carte "Balle de pioche" ne compte que les 3 meilleurs des 4 choix', () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b", "c", "d"],
        results: [
          { athleteId: "a", rank: 1 },
          { athleteId: "b", rank: 2 },
          { athleteId: "c", rank: 3 },
          { athleteId: "d", rank: 15 }, // le moins bon des 4, doit être exclu
        ],
        oddsByAthleteId: { a: 10, b: 10, c: 10, d: 10 },
        card: { type: "balle_de_pioche" },
      })
    );
    expect(result.breakdown.droppedByBalleDePioche).toEqual(["d"]);
    expect(result.perAthlete.d).toBeUndefined();
    expect(result.breakdown.combinationBonus).toBe(100); // podium sur les 3 comptés
  });
});

describe("computeIndividualRaceScore — bonus Team Nation", () => {
  it("double les points de l'athlète de la nation/sexe favori(te) sur son étape", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
        athleteTeamByAthleteId: { a: { nationCode: "FRA", sex: "F" } },
        favoriteTeam: { nationCode: "FRA", sex: "F" },
        raceCountryCode: "FRA",
      })
    );
    expect(result.perAthlete.a).toBe(500);
    expect(result.breakdown.teamNationBoostedAthleteIds).toEqual(["a"]);
  });

  it("ne s'applique pas hors de l'étape du pays favori", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1 }],
        oddsByAthleteId: { a: 10 },
        athleteTeamByAthleteId: { a: { nationCode: "FRA", sex: "F" } },
        favoriteTeam: { nationCode: "FRA", sex: "F" },
        raceCountryCode: "NOR",
      })
    );
    expect(result.perAthlete.a).toBe(250);
    expect(result.breakdown.teamNationBoostedAthleteIds).toEqual([]);
  });

  it("le doublement porte aussi sur le bonus Gâchette de l'athlète concerné", () => {
    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a"],
        results: [{ athleteId: "a", rank: 1, isGachette: true }],
        oddsByAthleteId: { a: 10 },
        athleteTeamByAthleteId: { a: { nationCode: "FRA", sex: "F" } },
        favoriteTeam: { nationCode: "FRA", sex: "F" },
        raceCountryCode: "FRA",
      })
    );
    // (250 base + 20 Gâchette) × 2 Team Nation = 540
    expect(result.perAthlete.a).toBe(540);
  });
});

describe("computeIndividualRaceScore — prono parfait avec Balle de pioche", () => {
  it("s'évalue sur les 3 meilleurs des 4 choix, pas sur les 4", () => {
    const results: AthleteRaceResult[] = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
      { athleteId: "d", rank: 15 }, // le moins bon des 4, exclu par la carte
    ];
    const odds = { a: 10, b: 10, c: 10, d: 10 };

    const result = computeIndividualRaceScore(
      baseInput({
        predictedAthleteIds: ["a", "b", "c", "d"],
        results,
        oddsByAthleteId: odds,
        card: { type: "balle_de_pioche" },
      })
    );

    // {a, b, c} est la meilleure combinaison du Top 10 sur cette course.
    expect(result.breakdown.droppedByBalleDePioche).toEqual(["d"]);
    expect(result.breakdown.pronoParfaitBonus).toBe(200);
  });
});

describe("computeAspirationBonus", () => {
  const athleteTeamByAthleteId = {
    a: { nationCode: "FRA", sex: "F" as const },
    b: { nationCode: "FRA", sex: "F" as const },
    c: { nationCode: "FRA", sex: "F" as const },
    d: { nationCode: "NOR", sex: "F" as const },
  };
  const favoriteTeam = { nationCode: "FRA", sex: "F" as const };

  it("aucun bonus sous 2 athlètes de la nation favorite dans le Top 10", () => {
    const results: AthleteRaceResult[] = [{ athleteId: "a", rank: 1 }];
    expect(computeAspirationBonus(results, athleteTeamByAthleteId, favoriteTeam)).toBe(0);
  });

  it("20 / 50 / 100 selon le nombre d'athlètes classés Top 10", () => {
    const two: AthleteRaceResult[] = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
    ];
    expect(computeAspirationBonus(two, athleteTeamByAthleteId, favoriteTeam)).toBe(20);

    const three: AthleteRaceResult[] = [...two, { athleteId: "c", rank: 3 }];
    expect(computeAspirationBonus(three, athleteTeamByAthleteId, favoriteTeam)).toBe(50);

    const threePlusOther: AthleteRaceResult[] = [...three, { athleteId: "d", rank: 4 }];
    expect(computeAspirationBonus(threePlusOther, athleteTeamByAthleteId, favoriteTeam)).toBe(50);
  });
});
