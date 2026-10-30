import { describe, expect, it } from "vitest";
import { formatShootings, parseShootings, shootingCount, totalMisses } from "../shootings";

describe("shootings", () => {
  it("2 tirs au sprint et en relais, 4 sinon", () => {
    expect(shootingCount("sprint")).toBe(2);
    expect(shootingCount("relais_mixte_simple")).toBe(2);
    expect(shootingCount("poursuite")).toBe(4);
    expect(shootingCount("individuel")).toBe(4);
    expect(shootingCount("mass_start")).toBe(4);
  });

  it("lit les fautes par tir", () => {
    expect(parseShootings("0+1+0+2")).toEqual([0, 1, 0, 2]);
    expect(parseShootings(" 1 + 0 ")).toEqual([1, 0]);
    expect(parseShootings("0 1 0 2")).toEqual([0, 1, 0, 2]);
    // Relais : péna + balles de pioche, un groupe par tir.
    expect(parseShootings("0+1 1+3")).toEqual([1, 4]);
    // 8 tirs d'équipe repliés en couché / debout.
    expect(parseShootings("0+1 0+2 0+0 1+3 0+1 0+0 0+2 0+1", 2)).toEqual([4, 7]);
    expect(parseShootings("")).toBeNull();
    expect(parseShootings("abc")).toBeNull();
  });

  it("formate et additionne", () => {
    expect(formatShootings([0, 1, 0, 2])).toBe("0+1+0+2");
    expect(formatShootings(null)).toBe("");
    expect(totalMisses([0, 1, 0, 2])).toBe(3);
    expect(totalMisses(null)).toBeNull();
  });
});
