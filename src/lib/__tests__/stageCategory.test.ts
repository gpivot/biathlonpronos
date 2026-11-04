import { describe, expect, it } from "vitest";
import { stageCategory, stageCategoryFields, stageCategoryFormValue, stageLabel } from "../stageCategory";
import { computeSeasonJokers } from "../jokers";
import { countStageWins } from "../playerBadges";
import { isCardFreeRace, quatriemeChoixWindow, type CardRace } from "../bonusCards";
import { buildCalendarCsv, OFF_STANDINGS_CATEGORY } from "../admin/calendarImport";

describe("catégorie d'étape", () => {
  it("lit les trois catégories", () => {
    expect(stageCategory({ coefficient: 1, counts_in_standings: true })).toBe("world_cup");
    expect(stageCategory({ coefficient: 2, counts_in_standings: true })).toBe("championship");
    expect(stageCategory({ coefficient: 1, counts_in_standings: false })).toBe("off_standings");
    // Avant la migration 0041, la colonne n'existe pas : l'étape compte.
    expect(stageCategory({ coefficient: 1 })).toBe("world_cup");
  });

  it("traduit le menu de l'admin en colonnes, aller et retour", () => {
    expect(stageCategoryFields("0")).toEqual({ coefficient: 1, counts_in_standings: false });
    expect(stageCategoryFields("2")).toEqual({ coefficient: 2, counts_in_standings: true });
    expect(stageCategoryFields("1")).toEqual({ coefficient: 1, counts_in_standings: true });
    expect(stageCategoryFields(null)).toEqual({ coefficient: 1, counts_in_standings: true });
    for (const v of ["0", "1", "2"]) expect(stageCategoryFormValue(stageCategoryFields(v))).toBe(v);
  });
});

describe("étape hors classement", () => {
  it("ses courses ne sont jamais prises par les jokers", () => {
    const jokers = computeSeasonJokers(
      [
        { id: "test", format: "sprint", coefficient: 1, finished: true, countsInStandings: false },
        { id: "s1", format: "sprint", coefficient: 1, finished: true },
      ],
      [
        { userId: "u", raceId: "test", points: 0 },
        { userId: "u", raceId: "s1", points: 50 },
      ],
      [],
      ["u"]
    );
    expect(jokers.get("u")!.erased.map((c) => c.raceId)).toEqual(["s1"]);
  });

  it("sans ses lignes de points (filtrées en base), elle ne donne pas de dossard rouge", () => {
    // getPlayerBadges ne lit que les lignes counts_in_standings = true : l'étape hors classement
    // n'a donc aucun point et n'a pas de vainqueur.
    const wins = countStageWins(
      [{ userId: "u", raceId: "s1", points: 50 }],
      [
        { id: "s1", stageId: "e1", finished: true },
        { id: "t1", stageId: "test", finished: true },
      ]
    );
    expect(wins.get("u")).toBe(1);
  });
});

describe("étape hors classement : cartes et CSV", () => {
  const race = (id: string, locks_at: string, extra: Partial<CardRace> = {}): CardRace => ({
    id,
    format: "sprint",
    sex: "H",
    locks_at,
    status: "upcoming",
    ...extra,
  });

  it("aucune carte, et le 4e choix saute ses courses", () => {
    expect(isCardFreeRace({ coefficient: 1, countsInStandings: false })).toBe(true);
    expect(isCardFreeRace({ coefficient: 1, countsInStandings: true })).toBe(false);
    const races = [
      race("a", "2026-12-01T10:00:00Z"),
      race("test", "2026-12-02T10:00:00Z", { countsInStandings: false }),
      race("b", "2026-12-03T10:00:00Z"),
    ];
    expect(quatriemeChoixWindow("a", races)).toEqual(["a", "b"]);
    expect(quatriemeChoixWindow("test", races)).toEqual([]);
  });

  it("l'export CSV écrit « Autre (hors classement) », relu par l'import", () => {
    const csv = buildCalendarCsv([
      { location: "Test", country_code: "FRA", coefficient: 1, counts_in_standings: false, races: [{ format: "sprint", sex: "H", locks_at: "2026-11-20T10:00:00Z" }] },
    ]);
    expect(csv).toContain("Autre (hors classement)");
    expect(OFF_STANDINGS_CATEGORY.test("Autre (hors classement)")).toBe(true);
    expect(OFF_STANDINGS_CATEGORY.test("Course test")).toBe(true);
    expect(OFF_STANDINGS_CATEGORY.test("Coupe du Monde")).toBe(false);
    expect(OFF_STANDINGS_CATEGORY.test("Championnats du Monde")).toBe(false);
  });
});

describe("mention d'étape", () => {
  it("garde un texte court, null si vide", () => {
    expect(stageLabel("  Pré-saison ")).toBe("Pré-saison");
    expect(stageLabel("")).toBeNull();
    expect(stageLabel(null)).toBeNull();
    expect(stageLabel("x".repeat(60))).toHaveLength(40);
  });
});
