import { describe, expect, it } from "vitest";
import { countRaceWins, countStageWins } from "../playerBadges";

describe("victoires de course des joueurs", () => {
  it("compte le meilleur pronostiqueur de chaque course", () => {
    const wins = countRaceWins([
      { userId: "a", raceId: "r1", points: 120 },
      { userId: "b", raceId: "r1", points: 80 },
      { userId: "b", raceId: "r2", points: 60 },
      { userId: "a", raceId: "r2", points: 10 },
      { userId: "a", raceId: "r3", points: 30 },
    ]);
    expect(wins.get("a")).toBe(2);
    expect(wins.get("b")).toBe(1);
  });

  it("additionne les lignes d'un même joueur sur une course", () => {
    const wins = countRaceWins([
      { userId: "a", raceId: "r1", points: 50 },
      { userId: "a", raceId: "r1", points: 40 },
      { userId: "b", raceId: "r1", points: 80 },
    ]);
    expect(wins.get("a")).toBe(1);
    expect(wins.has("b")).toBe(false);
  });

  it("donne la victoire à tous les ex æquo, et à personne sans point", () => {
    const wins = countRaceWins([
      { userId: "a", raceId: "r1", points: 40 },
      { userId: "b", raceId: "r1", points: 40 },
      { userId: "a", raceId: "r2", points: 0 },
      { userId: "b", raceId: "r2", points: -10 },
      { userId: "c", raceId: null, points: 500 },
    ]);
    expect(wins.get("a")).toBe(1);
    expect(wins.get("b")).toBe(1);
    expect(wins.has("c")).toBe(false);
  });
});

describe("étapes gagnées des joueurs (dossard rouge)", () => {
  const races = [
    { id: "s1", stageId: "e1", finished: true },
    { id: "p1", stageId: "e1", finished: true },
    { id: "s2", stageId: "e2", finished: true },
    { id: "p2", stageId: "e2", finished: false },
  ];

  it("additionne les points de toutes les courses de l'étape", () => {
    const wins = countStageWins(
      [
        { userId: "a", raceId: "s1", points: 100 },
        { userId: "b", raceId: "s1", points: 60 },
        { userId: "b", raceId: "p1", points: 70 },
      ],
      races
    );
    expect(wins.get("b")).toBe(1);
    expect(wins.has("a")).toBe(false);
  });

  it("ne compte pas une étape pas encore terminée", () => {
    const wins = countStageWins([{ userId: "a", raceId: "s2", points: 100 }], races);
    expect(wins.size).toBe(0);
  });

  it("donne l'étape à tous les ex æquo, et à personne sans point", () => {
    const wins = countStageWins(
      [
        { userId: "a", raceId: "s1", points: 50 },
        { userId: "b", raceId: "p1", points: 50 },
      ],
      races
    );
    expect(wins.get("a")).toBe(1);
    expect(wins.get("b")).toBe(1);
    expect(countStageWins([{ userId: "a", raceId: "s1", points: 0 }], races).size).toBe(0);
  });
});
