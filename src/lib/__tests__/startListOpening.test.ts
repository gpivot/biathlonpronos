import { describe, expect, it } from "vitest";
import { resolveStartList } from "../startList";
import { cupRowsToRanking, ibuRowsToStartNations, pickCup } from "../admin/ibuResults";
import { matchStartList, matchStartNations } from "../admin/startListImport";
import { needsGeneralStartList } from "../admin/startListOpening";

describe("liste provisoire du lundi 17 h", () => {
  it("sprint sans liste : tous les biathlètes cotés", () => {
    expect(resolveStartList("sprint", [], [])).toEqual({ status: "open" });
  });

  it("sprint avec le top 60 du général : liste provisoire", () => {
    expect(
      resolveStartList(
        "individuel",
        [
          { athlete_id: "a", start_position: 1, source: "general" },
          { athlete_id: "b", start_position: 2, source: "general" },
        ],
        []
      )
    ).toEqual({ status: "known", source: "general", gaps: {}, order: { a: 1, b: 2 } });
  });

  it("sprint avec la liste officielle IBU", () => {
    expect(resolveStartList("sprint", [{ athlete_id: "a", start_position: 4, source: "ibu" }], [])).toMatchObject({
      status: "known",
      source: "ibu",
    });
  });

  it("préparée de 15 h à 23 h le lundi, jamais après le départ", () => {
    const race = { format: "sprint", locks_at: "2026-11-27T13:15:00Z", stages: { season_id: "s", starts_on: "2026-11-26" } };
    expect(needsGeneralStartList(race, new Date("2026-11-23T13:59:00Z"))).toBe(false);
    expect(needsGeneralStartList(race, new Date("2026-11-23T14:00:00Z"))).toBe(true);
    expect(needsGeneralStartList(race, new Date("2026-11-23T22:00:00Z"))).toBe(true);
    expect(needsGeneralStartList(race, new Date("2026-11-24T08:00:00Z"))).toBe(false);
    expect(needsGeneralStartList({ ...race, format: "poursuite" }, new Date("2026-11-23T16:00:00Z"))).toBe(false);
    expect(needsGeneralStartList({ ...race, format: "relais_mixte" }, new Date("2026-11-23T16:00:00Z"))).toBe(true);
  });
});

describe("classement général IBU", () => {
  const cups = [
    { CupId: "BT2627SWRLCP__SWNC", Description: "Women's Nations Cup" },
    { CupId: "BT2627SWRLCP__SWTS", Description: "Women's World Cup Total Score" },
    { CupId: "BT2627SWRLCP__SMTS", Description: "Men's World Cup Total Score" },
    { CupId: "BT2627SWRLCP__SMRL", Description: "Men's Relay Score" },
  ];

  it("retrouve la bonne coupe", () => {
    expect(pickCup(cups, "total", "SW")?.CupId).toBe("BT2627SWRLCP__SWTS");
    expect(pickCup(cups, "relay", "SM")?.CupId).toBe("BT2627SWRLCP__SMRL");
    expect(pickCup(cups, "relay", "SW")).toBeNull();
  });

  it("garde les 60 premiers, ex aequo compris", () => {
    const rows = Array.from({ length: 70 }, (_, i) => ({ Rank: i < 61 ? Math.min(i + 1, 60) : i + 1, Name: `NOM${i} Prenom`, Nat: "NOR" }));
    const ranking = cupRowsToRanking(rows, 60);
    expect(ranking).toHaveLength(61);
    expect(ranking.at(-1)?.rank).toBe(60);
  });

  it("rapproche « NOM Prénom » des biathlètes cotés", () => {
    const matched = matchStartList(
      [{ position: 1, bib: null, firstName: "", lastName: "JEANMONNOT Lou", nation: "FRA" }],
      [{ id: "lou", firstName: "Lou", lastName: "Jeanmonnot", nationCode: "FRA" }]
    );
    expect(matched.rows).toEqual([{ athleteId: "lou", position: 1, bib: null }]);
  });
});

describe("relais", () => {
  it("nations de la liste IBU dans l'ordre des dossards", () => {
    expect(
      ibuRowsToStartNations([
        { IsTeam: true, Nat: "FRA", Bib: 2 },
        { IsTeam: false, Leg: 1, Nat: "FRA", FamilyName: "X", Bib: "2-1" },
        { IsTeam: true, Nat: "NOR", Bib: 1 },
      ])
    ).toEqual([
      { position: 1, nation: "NOR" },
      { position: 2, nation: "FRA" },
    ]);
  });

  it("garde les nations cotées", () => {
    expect(matchStartNations([{ nation: "NOR" }, { nation: "XYZ" }, { nation: "FRA" }, { nation: "NOR" }], ["FRA", "NOR"])).toEqual({
      rows: [
        { nation: "NOR", position: 1 },
        { nation: "FRA", position: 2 },
      ],
      unmatched: ["XYZ"],
    });
  });
});

describe("début de saison : cotes du jeu", () => {
  it("garde les plus petites cotes, ex aequo de la dernière place compris", async () => {
    const { topByOdds } = await import("../admin/startListOpening");
    const rows = [{ id: "c", value: 20 }, { id: "a", value: 5 }, { id: "b", value: 12 }, { id: "d", value: 12 }, { id: "e", value: 30 }];
    expect(topByOdds(rows, 2).map((r) => [r.id, r.rank])).toEqual([["a", 1], ["b", 2], ["d", 2]]);
    expect(topByOdds(rows, 10)).toHaveLength(5);
  });
});
