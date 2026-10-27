import { describe, expect, it } from "vitest";
import { ibuResultsToCsv, ibuSeasonId, ibuSeasonIdForDate, pickCompetition, pickEvent } from "../ibuResults";
import { parseResultsCsv } from "../resultsCsv";

describe("ibuSeasonId", () => {
  it("convertit le label de saison", () => {
    expect(ibuSeasonId("2026-27")).toBe("2627");
    expect(ibuSeasonId("2026-2027")).toBe("2627");
    expect(ibuSeasonId("test")).toBeNull();
  });

  it("déduit la saison IBU de la date de l'étape", () => {
    expect(ibuSeasonIdForDate("2025-11-29")).toBe("2526");
    expect(ibuSeasonIdForDate("2026-03-15")).toBe("2526");
    expect(ibuSeasonIdForDate("2026-11-28")).toBe("2627");
  });
});

describe("pickEvent / pickCompetition", () => {
  const events = [
    { EventId: "BT2627SWRLCP01", StartDate: "2026-11-28T00:00:00", EndDate: "2026-12-07T00:00:00", Organizer: "Kontiolahti", ShortDescription: "Kontiolahti (FIN)" },
    { EventId: "BT2627SWRLCP02", StartDate: "2026-12-08T00:00:00", EndDate: "2026-12-14T00:00:00", Organizer: "Hochfilzen", ShortDescription: "Hochfilzen (AUT)" },
  ];

  it("retrouve l'étape par dates et lieu", () => {
    expect(pickEvent(events, { location: "Kontiolahti", starts_on: "2026-11-29", ends_on: "2026-12-07" })?.EventId).toBe("BT2627SWRLCP01");
    const oestersund = [{ EventId: "BT2526SWRLCP01", StartDate: "2025-11-29T12:00:00Z", EndDate: "2025-12-07T12:00:00Z", Organizer: "Oestersund" }, ...events];
    expect(pickEvent(oestersund, { location: "Östersund", starts_on: "2025-11-29", ends_on: "2025-12-07" })?.EventId).toBe("BT2526SWRLCP01");
    expect(pickEvent(events, { location: "Ailleurs", starts_on: "2027-01-10", ends_on: "2027-01-12" })).toBeNull();
  });

  it("retrouve la course par discipline, catégorie et heure", () => {
    const competitions = [
      { RaceId: "W-SP", StartTime: "2026-12-03T13:15:00Z", catId: "SW", DisciplineId: "SP" },
      { RaceId: "M-SP", StartTime: "2026-12-04T13:15:00Z", catId: "SM", DisciplineId: "SP" },
      { RaceId: "MX-SR", StartTime: "2026-11-29T11:00:00Z", catId: "MX", DisciplineId: "SR" },
      { RaceId: "W-RL", StartTime: "2026-12-06T11:00:00Z", catId: "SW", DisciplineId: "RL" },
    ];
    expect(pickCompetition(competitions, { format: "sprint", sex: "F", locks_at: "2026-12-03T13:15:00Z" })?.RaceId).toBe("W-SP");
    expect(pickCompetition(competitions, { format: "relais_mixte_simple", sex: null, locks_at: "2026-11-29T11:15:00Z" })?.RaceId).toBe("MX-SR");
    expect(pickCompetition(competitions, { format: "relais_f", sex: null, locks_at: "2026-12-06T11:00:00Z" })?.RaceId).toBe("W-RL");
    expect(pickCompetition(competitions, { format: "sprint", sex: "F", locks_at: "2026-12-10T13:15:00Z" })).toBeNull();
  });
});

describe("ibuResultsToCsv", () => {
  it("athlètes : rang, écart, Gâchette (0 faute), Fusée, DNF ignoré", () => {
    const csv = ibuResultsToCsv(
      "athlete",
      [
        { Rank: "1", FamilyName: "SIMON", GivenName: "Julia", Nat: "FRA", Behind: "0.0", ShootingTotal: "0", IBUId: "X1" },
        { Rank: "2", FamilyName: "OEBERG", GivenName: "Elvira", Nat: "SWE", Behind: "+12.4", ShootingTotal: "1", IBUId: "X2" },
        { Rank: null, IRM: "DNF", FamilyName: "JEANMONNOT", GivenName: "Lou", Nat: "FRA", IBUId: "X3" },
      ],
      "X2"
    );
    const parsed = parseResultsCsv(csv, "athlete", [
      { id: "a1", firstName: "Julia", lastName: "Simon", nationCode: "FRA" },
      { id: "a2", firstName: "Elvira", lastName: "Öberg", nationCode: "SWE" },
      { id: "a3", firstName: "Lou", lastName: "Jeanmonnot", nationCode: "FRA" },
    ]);
    expect(parsed.rows.a1).toMatchObject({ rank: "1", timeGapSeconds: "0", isGachette: true, isFusee: false });
    expect(parsed.rows.a2).toMatchObject({ rank: "2", timeGapSeconds: "12.4", isGachette: false, isFusee: true });
    expect(parsed.rows.a3).toBeUndefined();
  });

  it("relais : seules les lignes d'équipe comptent", () => {
    const csv = ibuResultsToCsv("nation", [
      { Rank: "1", IsTeam: true, Nat: "NOR" },
      { Rank: "1", IsTeam: false, Leg: 1, Nat: "NOR", FamilyName: "X" },
      { Rank: "2", IsTeam: true, Nat: "FRA" },
    ]);
    const parsed = parseResultsCsv(csv, "nation", [
      { id: "NOR", nationCode: "NOR" },
      { id: "FRA", nationCode: "FRA" },
    ]);
    expect(parsed.rows.NOR.rank).toBe("1");
    expect(parsed.rows.FRA.rank).toBe("2");
    expect(parsed.warnings).toEqual([]);
  });
});
