import { describe, expect, it } from "vitest";
import { PICK_SHARE_MIN_PLAYERS, computePickShares, pickSharesVisible } from "../pickShares";

describe("computePickShares", () => {
  it("compte chaque joueur une fois par biathlète choisi", () => {
    const { total, shares } = computePickShares([
      { athlete_ids: ["perrot", "laegreid", "boe"] },
      { athlete_ids: ["perrot", "boe", "jacquelin"] },
      { athlete_ids: ["perrot", "fillon", "boe"] },
      { athlete_ids: ["samuelsson", "boe", "laegreid"] },
    ]);
    expect(total).toBe(4);
    expect(shares.perrot).toBe(75);
    expect(shares.boe).toBe(100);
    expect(shares.laegreid).toBe(50);
    expect(shares.jacquelin).toBe(25);
    expect(shares.inconnu).toBeUndefined();
  });

  it("relais : une nation par joueur", () => {
    const { total, shares } = computePickShares([{ nation_code: "FRA" }, { nation_code: "FRA" }, { nation_code: "NOR" }]);
    expect(total).toBe(3);
    expect(shares).toEqual({ FRA: 67, NOR: 33 });
  });

  it("ignore les pronostics vides et les doublons", () => {
    const { total, shares } = computePickShares([{ athlete_ids: [] }, { athlete_ids: null }, { athlete_ids: ["a", "a"] }]);
    expect(total).toBe(1);
    expect(shares).toEqual({ a: 100 });
  });
});

describe("pickSharesVisible", () => {
  it("avant le départ, seulement à partir du seuil de joueurs", () => {
    expect(pickSharesVisible(PICK_SHARE_MIN_PLAYERS - 1, false)).toBe(false);
    expect(pickSharesVisible(PICK_SHARE_MIN_PLAYERS, false)).toBe(true);
  });
  it("après le départ, toujours (sauf aucun pronostic)", () => {
    expect(pickSharesVisible(2, true)).toBe(true);
    expect(pickSharesVisible(0, true)).toBe(false);
  });
});
