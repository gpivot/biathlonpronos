import { describe, expect, it } from "vitest";
import { computeSeasonJokers, selectJokers, type JokerCandidate } from "../jokers";

const race = (raceId: string, points: number, extra: Partial<JokerCandidate> = {}): JokerCandidate => ({
  raceId,
  relay: false,
  championship: false,
  played: true,
  points,
  ...extra,
});

describe("jokers de fin de saison", () => {
  it("efface les 3 plus mauvaises courses individuelles et les 2 plus mauvais relais", () => {
    const { erased, delta } = selectJokers([
      race("s1", 120),
      race("s2", 5),
      race("s3", 0),
      race("s4", 40),
      race("s5", 300),
      race("r1", 30, { relay: true }),
      race("r2", 10, { relay: true }),
      race("r3", 60, { relay: true }),
    ]);
    expect(erased.map((c) => c.raceId)).toEqual(["s3", "s2", "s4", "r2", "r1"]);
    expect(delta).toBe(-(0 + 5 + 40 + 10 + 30));
  });

  it("efface d'abord les courses non jouées", () => {
    const { erased, delta } = selectJokers([
      race("s1", -300),
      race("s2", 0, { played: false }),
      race("s3", 12),
      race("s4", 50),
      race("s5", 0, { played: false }),
    ]);
    expect(erased.map((c) => c.raceId)).toEqual(["s2", "s5", "s1"]);
    expect(delta).toBe(300);
  });

  it("ne touche jamais aux Mondiaux ni aux JO", () => {
    const { erased } = selectJokers([
      race("w1", -50, { championship: true }),
      race("w2", 0, { championship: true, played: false }),
      race("wr", 0, { championship: true, relay: true, played: false }),
      race("s1", 80),
    ]);
    expect(erased.map((c) => c.raceId)).toEqual(["s1"]);
  });

  it("ne touche jamais aux courses malus ni bonus", () => {
    const { erased } = selectJokers([
      race("m1", -300, { special: true }),
      race("b1", 0, { special: true, played: false }),
      race("mr", 0, { special: true, relay: true, played: false }),
      race("s1", 80),
    ]);
    expect(erased.map((c) => c.raceId)).toEqual(["s1"]);
  });

  it("exclut les courses à règle spéciale dans le calcul par joueur", () => {
    const jokers = computeSeasonJokers(
      [
        { id: "m1", format: "sprint", coefficient: 1, finished: true, specialRule: "tour_de_pena" },
        { id: "s1", format: "sprint", coefficient: 1, finished: true, specialRule: null },
      ],
      [
        { userId: "u", raceId: "m1", points: -50 },
        { userId: "u", raceId: "s1", points: 20 },
      ],
      [
        { userId: "u", raceId: "m1", played: true },
        { userId: "u", raceId: "s1", played: true },
      ],
      ["u"]
    );
    expect(jokers.get("u")!.erased.map((c) => c.raceId)).toEqual(["s1"]);
    expect(jokers.get("u")!.delta).toBe(-20);
  });

  it("à égalité, efface la course la plus ancienne", () => {
    const { erased } = selectJokers([race("a", 0), race("b", 0), race("c", 0), race("d", 0)]);
    expect(erased.map((c) => c.raceId)).toEqual(["a", "b", "c"]);
  });

  it("calcule les jokers de chaque joueur, sans effacer le bonus Pépite", () => {
    const races = [
      { id: "s1", format: "sprint", coefficient: 1, finished: true },
      { id: "s2", format: "poursuite", coefficient: 1, finished: true },
      { id: "r1", format: "relais_h", coefficient: 1, finished: true },
      { id: "s3", format: "sprint", coefficient: 1, finished: false },
    ];
    const jokers = computeSeasonJokers(
      races,
      [
        { userId: "a", raceId: "s1", points: 150, pepiteBonus: 125 },
        { userId: "a", raceId: "s2", points: 40 },
        { userId: "a", raceId: "r1", points: 20 },
        { userId: "b", raceId: "s1", points: 10 },
        { userId: "a", raceId: null, points: 500 },
      ],
      [
        { userId: "a", raceId: "s1", played: true },
        { userId: "a", raceId: "s2", played: true },
        { userId: "a", raceId: "r1", played: true },
        { userId: "b", raceId: "s1", played: true },
      ],
      ["a", "b"]
    );
    // a : s1 vaut 25 hors Pépite, s2 40, r1 20 ; tout est effacé (3 individuelles possibles, 2 relais).
    expect(jokers.get("a")!.delta).toBe(-(25 + 40 + 20));
    // b : n'a joué ni s2 ni le relais, effacés d'abord ; s1 (10 pts) aussi, 3e joker individuel.
    expect(jokers.get("b")!.erased.map((c) => c.raceId)).toEqual(["s2", "s1", "r1"]);
    expect(jokers.get("b")!.delta).toBe(-10);
  });
});
