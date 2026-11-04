import { describe, expect, it } from "vitest";
import { cleanSupportMessage, SUPPORT_MESSAGE_MAX_LENGTH } from "../supportMessages";

describe("cleanSupportMessage", () => {
  it("garde le texte en retirant les espaces autour", () => {
    expect(cleanSupportMessage("  Bonjour,\r\nune erreur sur le sprint  ")).toBe("Bonjour,\nune erreur sur le sprint");
  });

  it("refuse un message vide", () => {
    expect(cleanSupportMessage("   \n ")).toBeNull();
  });

  it("refuse un message trop long", () => {
    expect(cleanSupportMessage("a".repeat(SUPPORT_MESSAGE_MAX_LENGTH))).not.toBeNull();
    expect(cleanSupportMessage("a".repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1))).toBeNull();
  });
});
