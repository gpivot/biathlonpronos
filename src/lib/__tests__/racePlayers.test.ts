import { describe, expect, it } from "vitest";
import { buildOngoingBoard, rankPlayers } from "../racePlayers";

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

describe("buildOngoingBoard", () => {
  it("classement général + pronostic, joueurs sans points à la suite", () => {
    const board = buildOngoingBoard(
      [
        { userId: "a", pseudo: "Alice", points: 300 },
        { userId: "b", pseudo: "Bob", points: 500 },
      ],
      [
        { userId: "a", pseudo: "Alice", picks: "Norvège" },
        { userId: "c", pseudo: "Chloé", picks: "France" },
      ]
    );
    expect(board.map((r) => [r.userId, r.rank, r.picks])).toEqual([
      ["b", 1, null],
      ["a", 2, "Norvège"],
      ["c", 3, "France"],
    ]);
  });
});
