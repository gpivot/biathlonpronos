import { describe, expect, it } from "vitest";
import { countRaceWins } from "../playerBadges";

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
