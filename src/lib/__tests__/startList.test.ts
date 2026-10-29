import { describe, expect, it } from "vitest";
import { resolveStartList } from "../startList";
import { ibuRowsToStartList } from "../admin/ibuResults";
import { matchStartList } from "../admin/startListImport";

describe("resolveStartList", () => {
  it("laisse ouvertes les courses sans qualification", () => {
    expect(resolveStartList("sprint", [], [])).toEqual({ status: "open" });
  });

  it("poursuite : 60 premiers du sprint, dans l'ordre du sprint", () => {
    const sprint = [
      { athlete_id: "a", rank: 1, time_gap_seconds: 0 },
      { athlete_id: "b", rank: 60, time_gap_seconds: 152.9 },
      { athlete_id: "c", rank: 61, time_gap_seconds: 155.2 },
    ];
    expect(resolveStartList("poursuite", [], sprint)).toEqual({
      status: "known",
      source: "sprint",
      order: { a: 1, b: 60 },
      gaps: { a: 0, b: 152, c: 155 },
    });
  });

  it("poursuite sans résultats du sprint : liste inconnue", () => {
    expect(resolveStartList("poursuite", [], []).status).toBe("pending");
  });

  it("mass start : inconnue tant que la liste IBU n'est pas récupérée", () => {
    expect(resolveStartList("mass_start", [], [{ athlete_id: "a", rank: 1 }]).status).toBe("pending");
  });

  it("la liste IBU enregistrée prime sur le sprint", () => {
    const list = resolveStartList("poursuite", [{ athlete_id: "x", start_position: 2 }], [{ athlete_id: "a", rank: 1 }]);
    expect(list).toEqual({ status: "known", source: "ibu", order: { x: 2 }, gaps: {} });
  });
});

describe("liste de départ IBU", () => {
  const rows = [
    { StartOrder: 2, Bib: "2", FamilyName: "OEBERG", GivenName: "Elvira", Nat: "SWE" },
    { StartOrder: 1, Bib: "1", FamilyName: "JEANMONNOT", GivenName: "Lou", Nat: "FRA" },
    { StartOrder: 3, Bib: "3", FamilyName: "INCONNUE", GivenName: "Anna", Nat: "GER" },
    { IsTeam: true, StartOrder: 4, Name: "France", Nat: "FRA" },
  ];

  it("trie par ordre de départ et ignore les lignes d'équipe", () => {
    expect(ibuRowsToStartList(rows).map((e) => [e.position, e.lastName])).toEqual([
      [1, "JEANMONNOT"],
      [2, "OEBERG"],
      [3, "INCONNUE"],
    ]);
  });

  it("rapproche les noms (translittération IBU) et signale les biathlètes sans cote", () => {
    const matched = matchStartList(ibuRowsToStartList(rows), [
      { id: "lou", firstName: "Lou", lastName: "Jeanmonnot", nationCode: "FRA" },
      { id: "elvira", firstName: "Elvira", lastName: "Öberg", nationCode: "SWE" },
    ]);
    expect(matched.rows).toEqual([
      { athleteId: "lou", position: 1, bib: 1 },
      { athleteId: "elvira", position: 2, bib: 2 },
    ]);
    expect(matched.unmatched).toEqual(["Anna INCONNUE (GER)"]);
  });
});
