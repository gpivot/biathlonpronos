import { describe, expect, it } from "vitest";
import { firstPredictedRaceAt, seasonChoicesEditable, seasonPicksClosesAt, seasonPicksPublicAt } from "../seasonChoices";

describe("seasonChoicesEditable", () => {
  const firstRace = new Date("2026-11-29T12:15:00Z");

  it("est modifiable avant le départ de la 1re course de Coupe du Monde", () => {
    expect(seasonChoicesEditable(firstRace, new Date("2026-11-29T12:14:59Z"))).toBe(true);
  });

  it("est verrouillé dès le départ", () => {
    expect(seasonChoicesEditable(firstRace, new Date("2026-11-29T12:15:00Z"))).toBe(false);
    expect(seasonChoicesEditable(firstRace, new Date("2026-12-05T10:00:00Z"))).toBe(false);
  });

  it("reste modifiable tant qu'aucune course n'est au calendrier", () => {
    expect(seasonChoicesEditable(null, new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });
});

describe("seasonPicksClosesAt (pronos de saison : 1re course pronostiquée, au plus tard Grand-Bornand)", () => {
  const firstWorldCupRaceAt = new Date("2026-11-26T15:10:00Z");
  const closingRaceAt = new Date("2026-12-20T13:15:00Z");

  it("joueur qui a pronostiqué Kontiolahti : fermé au départ de cette course", () => {
    const firstPredictedRaceAt = new Date("2026-11-26T15:10:00Z");
    expect(seasonPicksClosesAt({ firstPredictedRaceAt, closingRaceAt, firstWorldCupRaceAt })).toEqual(firstPredictedRaceAt);
  });

  it("nouveau joueur sans pronostic : ouvert jusqu'à la mass start femmes du Grand-Bornand", () => {
    const closesAt = seasonPicksClosesAt({ firstPredictedRaceAt: null, closingRaceAt, firstWorldCupRaceAt });
    expect(closesAt).toEqual(closingRaceAt);
    expect(seasonChoicesEditable(closesAt, new Date("2026-12-05T10:00:00Z"))).toBe(true);
    expect(seasonChoicesEditable(closesAt, new Date("2026-12-20T13:15:00Z"))).toBe(false);
  });

  it("1re course pronostiquée après le Grand-Bornand : c'est le Grand-Bornand qui ferme", () => {
    const firstPredictedRaceAt = new Date("2027-01-08T13:00:00Z");
    expect(seasonPicksClosesAt({ firstPredictedRaceAt, closingRaceAt, firstWorldCupRaceAt })).toEqual(closingRaceAt);
  });

  it("Grand-Bornand absent du calendrier : repli sur la 1re course de Coupe du Monde", () => {
    expect(seasonPicksClosesAt({ firstPredictedRaceAt: null, closingRaceAt: null, firstWorldCupRaceAt })).toEqual(firstWorldCupRaceAt);
  });

  it("calendrier vide : pas de date, donc ouvert", () => {
    const closesAt = seasonPicksClosesAt({ firstPredictedRaceAt: null, closingRaceAt: null, firstWorldCupRaceAt: null });
    expect(closesAt).toBeNull();
    expect(seasonChoicesEditable(closesAt, new Date())).toBe(true);
  });
});

describe("firstPredictedRaceAt (invité devenu joueur, 0048)", () => {
  const guestRace = new Date("2026-11-29T12:15:00Z");
  const nextRace = new Date("2026-12-04T13:00:00Z");

  it("joueur inscrit directement : sa 1re course pronostiquée", () => {
    expect(firstPredictedRaceAt([nextRace, guestRace], null)).toEqual(guestRace);
  });

  it("la course jouée en invité, partie avant la création du compte, ne compte pas", () => {
    const accountCompletedAt = new Date("2026-11-30T09:00:00Z");
    expect(firstPredictedRaceAt([guestRace], accountCompletedAt)).toBeNull();
    expect(firstPredictedRaceAt([guestRace, nextRace], accountCompletedAt)).toEqual(nextRace);
  });

  it("compte créé avant le départ de la course jouée en invité : elle compte", () => {
    expect(firstPredictedRaceAt([guestRace], new Date("2026-11-28T09:00:00Z"))).toEqual(guestRace);
  });

  it("après l'inscription : ouverts jusqu'au Grand-Bornand tant qu'il n'a pas pronostiqué d'autre course", () => {
    const closingRaceAt = new Date("2026-12-20T13:15:00Z");
    const first = firstPredictedRaceAt([guestRace], new Date("2026-11-30T09:00:00Z"));
    const closesAt = seasonPicksClosesAt({ firstPredictedRaceAt: first, closingRaceAt, firstWorldCupRaceAt: guestRace });
    expect(closesAt).toEqual(closingRaceAt);
    expect(seasonChoicesEditable(closesAt, new Date("2026-11-30T10:00:00Z"))).toBe(true);
  });
});

describe("seasonPicksPublicAt (globes des autres joueurs visibles quand plus personne ne peut modifier)", () => {
  const grandBornand = new Date("2026-12-13T13:15:00Z");
  const firstWorldCup = new Date("2026-11-29T12:15:00Z");

  it("mass start femmes du Grand-Bornand au calendrier : c'est elle", () => {
    expect(seasonPicksPublicAt(grandBornand, firstWorldCup)).toEqual(grandBornand);
  });

  it("Grand-Bornand absent : repli sur la 1re course de Coupe du Monde", () => {
    expect(seasonPicksPublicAt(null, firstWorldCup)).toEqual(firstWorldCup);
  });

  it("rien au calendrier : pas encore visibles", () => {
    expect(seasonPicksPublicAt(null, null)).toBeNull();
  });
});
