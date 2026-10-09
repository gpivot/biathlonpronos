import { describe, expect, it } from "vitest";
import { updateStreak } from "../streak";

describe("updateStreak", () => {
  it("incrémente la série quand la course rapporte des points", () => {
    expect(updateStreak(3, 42)).toEqual({ currentStreak: 4, cardEarned: false });
  });

  it("remet la série à zéro quand la course ne rapporte aucun point", () => {
    expect(updateStreak(7, 0)).toEqual({ currentStreak: 0, cardEarned: false });
    expect(updateStreak(7, -30)).toEqual({ currentStreak: 0, cardEarned: false });
  });

  it("attribue une carte bonus à la 10e course consécutive et repart de zéro", () => {
    expect(updateStreak(9, 10)).toEqual({ currentStreak: 0, cardEarned: true });
  });
});
