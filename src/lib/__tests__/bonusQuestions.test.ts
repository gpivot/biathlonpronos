import { describe, expect, it } from "vitest";
import { bonusQuestionLedgerRows, bonusQuestionState, cleanOptions } from "../bonusQuestions";

const locksAt = "2026-12-05T13:00:00Z";

describe("bonusQuestionState", () => {
  it("question avant le départ : ouverte jusqu'au départ de la course", () => {
    const q = { kind: "pre_race" as const, opens_at: null, closes_at: null };
    expect(bonusQuestionState(q, locksAt, new Date("2026-12-05T12:59:59Z"))).toBe("open");
    expect(bonusQuestionState(q, locksAt, new Date("2026-12-05T13:00:00Z"))).toBe("closed");
  });

  it("question live : brouillon tant qu'elle n'est pas lancée", () => {
    expect(bonusQuestionState({ kind: "live", opens_at: null, closes_at: null }, locksAt, new Date())).toBe("draft");
  });

  it("question live : suit l'heure réelle, pas l'horloge simulée", () => {
    const q = { kind: "live" as const, opens_at: "2026-12-05T13:20:00Z", closes_at: "2026-12-05T13:25:00Z" };
    const simulated = new Date("2025-01-01T00:00:00Z");
    expect(bonusQuestionState(q, locksAt, simulated, new Date("2026-12-05T13:19:00Z"))).toBe("scheduled");
    expect(bonusQuestionState(q, locksAt, simulated, new Date("2026-12-05T13:24:59Z"))).toBe("open");
    expect(bonusQuestionState(q, locksAt, simulated, new Date("2026-12-05T13:25:00Z"))).toBe("closed");
  });
});

describe("cleanOptions", () => {
  it("retire les réponses vides et accepte 2 à 4 réponses avant le départ", () => {
    expect(cleanOptions([" Oui ", "Non", "", ""], "pre_race")).toEqual(["Oui", "Non"]);
    expect(cleanOptions(["A", "B", "C", "D"], "pre_race")).toEqual(["A", "B", "C", "D"]);
    expect(cleanOptions(["A", "", "", ""], "pre_race")).toBeNull();
  });

  it("exige exactement 2 réponses en live", () => {
    expect(cleanOptions(["Oui", "Non"], "live")).toEqual(["Oui", "Non"]);
    expect(cleanOptions(["Oui", ""], "live")).toBeNull();
    expect(cleanOptions(["A", "B", "C"], "live")).toBeNull();
  });

  it("refuse une réponse trop longue", () => {
    expect(cleanOptions(["x".repeat(81), "Non"], "live")).toBeNull();
  });
});

describe("bonusQuestionLedgerRows", () => {
  it("donne 20 pts aux bonnes réponses seulement", () => {
    const rows = bonusQuestionLedgerRows(
      [
        { user_id: "u1", option_index: 1 },
        { user_id: "u2", option_index: 0 },
        { user_id: "u3", option_index: 1 },
      ],
      1,
      "q",
      "s"
    );
    expect(rows.map((r) => r.user_id)).toEqual(["u1", "u3"]);
    expect(rows[0]).toMatchObject({ points: 20, bonus_question_id: "q", season_id: "s" });
  });
});
