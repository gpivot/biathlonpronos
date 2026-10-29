import { describe, expect, it } from "vitest";
import { rankPlayers } from "../racePlayers";

describe("rankPlayers", () => {
  it("trie par points avec ex æquo", () => {
    const ranked = rankPlayers([
      { userId: "a", pseudo: "Alice", points: 50 },
      { userId: "b", pseudo: "Bob", points: 120 },
      { userId: "c", pseudo: "Chloé", points: 120 },
      { userId: "d", pseudo: "Dan", points: 0 },
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["c", 1],
      ["a", 3],
      ["d", 4],
    ]);
  });
});
