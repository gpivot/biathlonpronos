import { describe, expect, it } from "vitest";
import { offStartPicks } from "../notifications/plan";

describe("choix absents de la liste de départ", () => {
  it("signale seulement les biathlètes hors liste, par joueur", () => {
    const result = offStartPicks(
      [
        { user_id: "u1", picks: ["a", "b", "c"] },
        { user_id: "u2", picks: ["a", "x", "y"] },
        { user_id: "u3", picks: [] },
      ],
      ["a", "b", "c"]
    );
    expect([...result.entries()]).toEqual([["u2", ["x", "y"]]]);
  });

  it("relais : la nation choisie", () => {
    expect(offStartPicks([{ user_id: "u1", picks: ["NOR"] }], ["FRA", "GER"]).get("u1")).toEqual(["NOR"]);
    expect(offStartPicks([{ user_id: "u1", picks: [null] }], ["FRA"]).size).toBe(0);
  });

  it("aucune liste enregistrée : rien à signaler", () => {
    expect(offStartPicks([{ user_id: "u1", picks: ["x"] }], []).size).toBe(0);
  });
});
