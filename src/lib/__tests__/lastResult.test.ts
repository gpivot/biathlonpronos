import { describe, expect, it } from "vitest";
import {
  applyFuseeGachetteRules,
  fuseeCardPoints,
  fuseeGachetteEligibility,
  gachetteCardPoints,
  skiRankOf,
} from "../scoring/fuseeGachette";
import { computeIndividualPickPoints, computeIndividualExtras, computeResultRowPoints, pickLastResultRaces } from "../lastResult";
import { computeIndividualRaceScore } from "../scoring";
import type { IndividualRaceScoringInput } from "../scoring";

const results = [
  { athleteId: "a", rank: 1, isFusee: true },
  { athleteId: "b", rank: 2, isGachette: true, skiRank: 3 },
  { athleteId: "c", rank: 7, skiRank: 2 },
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
    stageCoefficient: input.stageCoefficient,
    bonusX2: input.bonusX2Active,
    caFarteTargetId: input.card.type === "ca_farte" ? input.card.targetAthleteId : null,
  });
  for (const id of input.predictedAthleteIds) {
    const cards = (engine.breakdown.fuseeByAthlete?.[id] ?? 0) + (engine.breakdown.gachetteByAthlete?.[id] ?? 0);
    expect(rebuilt[id]).toBe(id in engine.perAthlete ? engine.perAthlete[id] + cards : null);
  }
  const extras = computeIndividualExtras(engine.breakdown).reduce((s, e) => s + e.points, 0);
  const picks = Object.values(rebuilt).reduce<number>((s, v) => s + (v ?? 0), 0);
  expect(picks + extras).toBe(engine.total);
}

describe("encart Dernier résultat : points par athlète", () => {
  it("course simple", () => expectSameAsEngine(baseInput({})));
  it("cartes Fusée et Gâchette (points fixes)", () =>
    expectSameAsEngine(baseInput({ raceFormat: "poursuite", stageCards: { fusee: true, gachette: true }, bonusX2Active: true })));
  it("Tour de péna, pronostic incomplet", () =>
    expectSameAsEngine(baseInput({ predictedAthleteIds: ["a"], specialRule: "tour_de_pena" })));
  it("bonus ×2 personnel", () => expectSameAsEngine(baseInput({ bonusX2Active: true })));
  it("étape Mondiaux (coeff. ×2)", () => expectSameAsEngine(baseInput({ stageCoefficient: 2 })));
  it("carte Ça farte", () => expectSameAsEngine(baseInput({ bonusX2Active: true, card: { type: "ca_farte", targetAthleteId: "c" } })));
  it("Balle de pioche : le 4e choix ne compte pas", () =>
    expectSameAsEngine(baseInput({ predictedAthleteIds: ["a", "b", "c", "d"], card: { type: "balle_de_pioche" } })));
  it("Team Nation à domicile", () =>
    expectSameAsEngine(baseInput({ favoriteTeam: { nationCode: "FRA", sex: "H" } })));
  it("Fête nationale (équipe favorite dans le Top 10)", () =>
    expectSameAsEngine(baseInput({ specialRule: "fete_nationale", nationalDayTeam: { nationCode: "FRA", sex: "H" } })));
  it("Fête nationale avec un bonus ×2 perso (pas de cumul)", () =>
    expectSameAsEngine(
      baseInput({ specialRule: "fete_nationale", nationalDayTeam: { nationCode: "FRA", sex: "H" }, bonusX2Active: true })
    ));
  it("podium complet (bonus de combinaison)", () => expectSameAsEngine(baseInput({ predictedAthleteIds: ["a", "b", "e"] })));
});

describe("points du barème dans le classement d'une course", () => {
  it("cote × rang dans le Top 10 (Fusée et Gâchette sont des cartes, hors barème)", () => {
    expect(computeResultRowPoints({ rank: 1, odds: 2, relay: false })).toBe(50);
    expect(computeResultRowPoints({ rank: 10, odds: 7, relay: false })).toBe(7);
  });

  it("rien au-delà du Top 10", () => {
    expect(computeResultRowPoints({ rank: 11, odds: 7, relay: false })).toBeNull();
  });

  it("relais : barème réduit, Top 5 seulement", () => {
    expect(computeResultRowPoints({ rank: 1, odds: 3, relay: true })).toBe(30);
    expect(computeResultRowPoints({ rank: 6, odds: 3, relay: true })).toBeNull();
  });
});

describe("Fusée et Gâchette selon le format (§15, cartes depuis le 04/11/2026)", () => {
  it("les 4 formats individuels, jamais les relais", () => {
    for (const format of ["sprint", "individuel", "poursuite", "mass_start"]) {
      expect(fuseeGachetteEligibility(format)).toEqual({ fusee: true, gachette: true });
    }
    expect(fuseeGachetteEligibility("relais_h")).toEqual({ fusee: false, gachette: false });
  });

  it("une case cochée sur un relais ne compte pas", () => {
    expect(applyFuseeGachetteRules("sprint", { is_fusee: true, is_gachette: true })).toEqual({ is_fusee: true, is_gachette: true });
    expect(applyFuseeGachetteRules("relais_f", { is_fusee: true, is_gachette: true })).toEqual({ is_fusee: false, is_gachette: false });
  });

  it("rang au temps de ski : ski_rank, à défaut la case Fusée", () => {
    expect(skiRankOf({ ski_rank: 2, is_fusee: false })).toBe(2);
    expect(skiRankOf({ ski_rank: null, is_fusee: true })).toBe(1);
    expect(skiRankOf({ ski_rank: null, is_fusee: false })).toBeNull();
  });

  it("points des cartes", () => {
    expect([1, 2, 3, 4].map((r) => fuseeCardPoints(r))).toEqual([100, 50, 20, 0]);
    expect(gachetteCardPoints("sprint", true)).toBe(50);
    expect(gachetteCardPoints("individuel", true)).toBe(100);
    expect(gachetteCardPoints("mass_start", false)).toBe(0);
  });
});

describe("Derniers résultats de l'accueil : dernier Hommes et dernier Femmes gardés 48 h", () => {
  const now = new Date("2026-12-07T18:00:00Z");
  const race = (id: string, sex: string | null, locks_at: string) => ({ id, sex, locks_at });

  it("garde le dernier de chaque sexe dans les 48 h, le plus récent chasse l'ancien", () => {
    const races = [
      race("poursuite-h", "H", "2026-12-07T13:00:00Z"),
      race("sprint-h", "H", "2026-12-06T13:00:00Z"),
      race("sprint-f", "F", "2026-12-06T10:00:00Z"),
    ];
    expect(pickLastResultRaces(races, now).map((r) => r.id)).toEqual(["poursuite-h", "sprint-f"]);
  });

  it("un résultat de plus de 48 h disparaît", () => {
    const races = [race("poursuite-h", "H", "2026-12-07T13:00:00Z"), race("sprint-f", "F", "2026-12-05T10:00:00Z")];
    expect(pickLastResultRaces(races, now).map((r) => r.id)).toEqual(["poursuite-h"]);
  });

  it("relais mixte : sa propre catégorie", () => {
    const races = [race("mixte", null, "2026-12-07T13:00:00Z"), race("sprint-h", "H", "2026-12-06T13:00:00Z")];
    expect(pickLastResultRaces(races, now).map((r) => r.id)).toEqual(["mixte", "sprint-h"]);
  });

  it("rien dans les 48 h : la dernière course notée reste affichée", () => {
    const races = [race("sprint-f", "F", "2026-11-29T10:00:00Z"), race("sprint-h", "H", "2026-11-28T10:00:00Z")];
    expect(pickLastResultRaces(races, now).map((r) => r.id)).toEqual(["sprint-f"]);
  });
});
