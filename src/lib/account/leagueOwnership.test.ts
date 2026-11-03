import { describe, expect, it } from "vitest";
import { leagueFates } from "./leagueOwnership";

describe("leagueFates", () => {
  const me = "me";
  it("transmet la ligue au membre le plus ancien", () => {
    const fates = leagueFates(
      ["L1"],
      [
        { league_id: "L1", user_id: me, joined_at: "2026-10-01T00:00:00Z" },
        { league_id: "L1", user_id: "b", joined_at: "2026-10-05T00:00:00Z" },
        { league_id: "L1", user_id: "a", joined_at: "2026-10-03T00:00:00Z" },
      ],
      me
    );
    expect(fates).toEqual([{ leagueId: "L1", newOwnerId: "a" }]);
  });

  it("supprime une ligue sans autre membre", () => {
    const fates = leagueFates(["L1", "L2"], [{ league_id: "L1", user_id: me, joined_at: "2026-10-01T00:00:00Z" }, { league_id: "L2", user_id: "x", joined_at: "2026-10-02T00:00:00Z" }], me);
    expect(fates).toEqual([{ leagueId: "L1", delete: true }, { leagueId: "L2", newOwnerId: "x" }]);
  });
});
