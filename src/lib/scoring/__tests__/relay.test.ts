import { describe, expect, it } from "vitest";
import { computeRelayScore } from "../relay";

describe("computeRelayScore", () => {
  it("applique cote × multiplicateur de rang", () => {
    const result = computeRelayScore({
      predictedNationCode: "FRA",
      results: [{ nationCode: "FRA", rank: 1 }],
      oddsByNationCode: { FRA: 8 },
      stageCoefficient: 1,
      bonusX2Active: false,
    });
    expect(result.total).toBe(80); // 8 × 10
  });

  it("ne rapporte rien au-delà de la 5e nation", () => {
    const result = computeRelayScore({
      predictedNationCode: "FRA",
      results: [{ nationCode: "FRA", rank: 6 }],
      oddsByNationCode: { FRA: 8 },
      stageCoefficient: 1,
      bonusX2Active: false,
    });
    expect(result.total).toBe(0);
  });

  it("double avec le coefficient Mondiaux/JO ou le bonus ×2 personnel, jamais les deux", () => {
    const base = {
      predictedNationCode: "FRA",
      results: [{ nationCode: "FRA", rank: 1 }],
      oddsByNationCode: { FRA: 8 },
    };
    expect(computeRelayScore({ ...base, stageCoefficient: 2, bonusX2Active: false }).total).toBe(160);
    expect(computeRelayScore({ ...base, stageCoefficient: 1, bonusX2Active: true }).total).toBe(160);
    expect(computeRelayScore({ ...base, stageCoefficient: 2, bonusX2Active: true }).total).toBe(160);
  });
});
