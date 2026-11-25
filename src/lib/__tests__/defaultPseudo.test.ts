import { describe, expect, it } from "vitest";
import { isDefaultPseudo } from "../defaultPseudo";

describe("isDefaultPseudo", () => {
  it("détecte le pseudo tiré d'un e-mail relais Apple", () => {
    expect(isDefaultPseudo("x7k2qp9mzd", "x7k2qp9mzd@privaterelay.appleid.com")).toBe(true);
  });
  it("détecte le pseudo tiré de l'e-mail, sans tenir compte de la casse", () => {
    expect(isDefaultPseudo("Jean.Dupont", "jean.dupont@gmail.com")).toBe(true);
  });
  it("détecte un pseudo vide ou « Invité »", () => {
    expect(isDefaultPseudo("", "a@b.fr")).toBe(true);
    expect(isDefaultPseudo("Invité", null)).toBe(true);
  });
  it("laisse tranquille un pseudo choisi", () => {
    expect(isDefaultPseudo("Le Roi du Couché", "x7k2qp9mzd@privaterelay.appleid.com")).toBe(false);
    expect(isDefaultPseudo("jean", "jean.dupont@gmail.com")).toBe(false);
  });
});
