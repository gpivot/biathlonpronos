import { describe, expect, it } from "vitest";
import { countFavoriteTeamPodiums } from "../favoriteTeamStats";

describe("victoires et podiums de l'équipe favorite", () => {
  const team = { nationCode: "FRA", sex: "F" };
  it("compte les biathlètes de la nation et du sexe, et les relais du même sexe", () => {
    const rows = [
      { rank: 1, athlete: { nation_code: "FRA", sex: "F" }, nationCode: null, raceSex: "F" },
      { rank: 3, athlete: { nation_code: "FRA", sex: "F" }, nationCode: null, raceSex: "F" },
      { rank: 1, athlete: { nation_code: "FRA", sex: "H" }, nationCode: null, raceSex: "H" },
      { rank: 2, athlete: { nation_code: "NOR", sex: "F" }, nationCode: null, raceSex: "F" },
      { rank: 2, athlete: null, nationCode: "FRA", raceSex: "F" },
      { rank: 1, athlete: null, nationCode: "FRA", raceSex: null },
      { rank: 4, athlete: { nation_code: "FRA", sex: "F" }, nationCode: null, raceSex: "F" },
    ];
    expect(countFavoriteTeamPodiums(rows, team)).toEqual({ wins: 1, podiums: 3 });
  });
});
