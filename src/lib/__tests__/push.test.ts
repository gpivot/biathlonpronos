import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
  registerPlugin: () => ({}),
}));

import { buildFcmMessage, isInvalidTokenResponse, readServiceAccount } from "../push/fcm";
import { notificationPath } from "../native/firebaseMessaging";

describe("notificationPath", () => {
  it("ajoute la langue du joueur à un chemin du site", () => {
    expect(notificationPath({ url: "/courses/12" }, "en")).toBe("/en/courses/12");
    expect(notificationPath({ url: "/" }, "de")).toBe("/de");
  });

  it("garde la langue déjà présente", () => {
    expect(notificationPath({ url: "/it/classement" }, "fr")).toBe("/it/classement");
    expect(notificationPath({ url: "/fr" }, "en")).toBe("/fr");
  });

  it("refuse les adresses externes et les données absentes", () => {
    expect(notificationPath({ url: "https://exemple.com" }, "fr")).toBeNull();
    expect(notificationPath({ url: "//exemple.com" }, "fr")).toBeNull();
    expect(notificationPath({ url: "/\\exemple.com" }, "fr")).toBeNull();
    expect(notificationPath({}, "fr")).toBeNull();
    expect(notificationPath(null, "fr")).toBeNull();
  });
});

describe("buildFcmMessage", () => {
  it("met le lien dans les données de la notification", () => {
    const { message } = buildFcmMessage("tok", { title: "Question bonus", body: "Qui gagne ?", url: "/courses/3" });
    expect(message.token).toBe("tok");
    expect(message.notification).toEqual({ title: "Question bonus", body: "Qui gagne ?" });
    expect(message.data).toEqual({ url: "/courses/3" });
  });

  it("n'envoie pas de lien vide", () => {
    expect(buildFcmMessage("tok", { title: "a", body: "b" }).message.data).toEqual({});
  });
});

describe("isInvalidTokenResponse", () => {
  it("reconnaît un téléphone désinscrit", () => {
    expect(isInvalidTokenResponse(404, null)).toBe(true);
    expect(
      isInvalidTokenResponse(400, { error: { message: "x", details: [{ errorCode: "UNREGISTERED" }] } })
    ).toBe(true);
    expect(
      isInvalidTokenResponse(400, {
        error: { message: "The registration token is not a valid FCM registration token", details: [{ errorCode: "INVALID_ARGUMENT" }] },
      })
    ).toBe(true);
  });

  it("ne supprime pas le jeton pour une autre erreur", () => {
    expect(isInvalidTokenResponse(500, null)).toBe(false);
    expect(isInvalidTokenResponse(429, null)).toBe(false);
    expect(
      isInvalidTokenResponse(400, { error: { message: "Invalid JSON payload", details: [{ errorCode: "INVALID_ARGUMENT" }] } })
    ).toBe(false);
  });
});

describe("readServiceAccount", () => {
  it("lit le JSON du compte de service", () => {
    const raw = JSON.stringify({ project_id: "p", client_email: "e@p.iam", private_key: "k", other: 1 });
    expect(readServiceAccount(raw)?.project_id).toBe("p");
  });

  it("renvoie null si la variable est absente ou incomplète", () => {
    expect(readServiceAccount(undefined)).toBeNull();
    expect(readServiceAccount("pas du json")).toBeNull();
    expect(readServiceAccount(JSON.stringify({ project_id: "p" }))).toBeNull();
  });
});
