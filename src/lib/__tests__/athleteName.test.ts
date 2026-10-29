import { describe, expect, it } from "vitest";
import { abbreviateCompoundName, shortAthleteName } from "../athleteName";

describe("shortAthleteName", () => {
  it("garde un nom simple entier", () => {
    expect(shortAthleteName({ first_name: "Julia", last_name: "Simon" })).toBe("J. Simon");
  });
  it("abrège un nom composé avec tiret", () => {
    expect(shortAthleteName({ first_name: "Johannes", last_name: "DALE-SKJEVDAL" })).toBe("J. DALE-S.");
  });
  it("abrège un nom composé avec espace", () => {
    expect(shortAthleteName({ first_name: "Quentin", last_name: "Fillon Maillet" })).toBe("Q. Fillon M.");
  });
  it("sans athlète", () => {
    expect(shortAthleteName(null)).toBe("?");
    expect(shortAthleteName(undefined, "")).toBe("");
  });
  it("trois parties", () => {
    expect(abbreviateCompoundName("Dale-Skjevdal-Boe")).toBe("Dale-S.-B.");
  });
});
