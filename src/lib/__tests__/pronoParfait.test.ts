import { describe, expect, it } from "vitest";
import { markPronoParfait } from "../lastResult";

describe("markPronoParfait", () => {
  it("marque les 3 meilleurs scores du Top 10", () => {
    const rows = [
      { rank: 1, points: 95 },
      { rank: 2, points: 108 },
      { rank: 3, points: 65 },
      { rank: 4, points: 140 },
      { rank: 11, points: null },
    ];
    expect(markPronoParfait(rows).map((r) => r.perfect)).toEqual([true, true, false, true, false]);
  });
  it("rien sans 3 scores", () => {
    expect(markPronoParfait([{ rank: 1, points: 10 }, { rank: 2, points: null }]).some((r) => r.perfect)).toBe(false);
  });
});
