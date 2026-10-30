import { describe, expect, it } from "vitest";
import {
  canPlayCard,
  cardsOnRace,
  computeEquipeBonus,
  isCardUnlocked,
  offeredCards,
  describeCard,
  quatriemeChoixWindow,
  resolvePredictionCard,
  unclaimedCredits,
  type CardRace,
  type CardRow,
} from "../bonusCards";

// Une saison : sprints H/F, relais, poursuites H/F, puis une étape suivante.
const race = (id: string, format: string, sex: string | null, day: number, status = "upcoming"): CardRace => ({
  id,
  format,
  sex,
  locks_at: new Date(Date.UTC(2026, 11, day, 12)).toISOString(),
  status,
});
const races: CardRace[] = [
  race("sprintF", "sprint", "F", 1),
  race("sprintH", "sprint", "H", 2),
  race("relaisF", "relais_f", "F", 3),
  race("poursuiteF", "poursuite", "F", 4),
  race("poursuiteH", "poursuite", "H", 4),
  race("relaisMixte", "relais_mixte", null, 5),
  race("sprintF2", "sprint", "F", 8),
  race("sprintH2", "sprint", "H", 9),
];

const card = (over: Partial<CardRow>): CardRow => ({ id: "c", card_type: "balle_de_pioche", status: "available", used_on_race_id: null, ...over });

describe("quatriemeChoixWindow", () => {
  it("couvre la course d'activation puis 2 courses par sexe, relais exclus", () => {
    expect(quatriemeChoixWindow("sprintF", races)).toEqual(["sprintF", "sprintH", "poursuiteF", "poursuiteH"]);
    expect(quatriemeChoixWindow("sprintH", races)).toEqual(["sprintH", "poursuiteF", "poursuiteH", "sprintF2"]);
  });

  it("déborde sur l'étape suivante et se raccourcit en fin de saison", () => {
    // Poursuites H et F au même horaire : la course d'activation passe en premier.
    expect(quatriemeChoixWindow("poursuiteH", races)).toEqual(["poursuiteH", "poursuiteF", "sprintF2", "sprintH2"]);
    expect(quatriemeChoixWindow("sprintH2", races)).toEqual(["sprintH2"]);
  });

  it("jamais sur un relais", () => {
    expect(quatriemeChoixWindow("relaisF", races)).toEqual([]);
  });
});

describe("cartes jouées", () => {
  const played = [card({ id: "q", status: "used", used_on_race_id: "sprintF" })];

  it("le 4e choix s'applique à toute sa fenêtre", () => {
    expect(cardsOnRace("poursuiteH", played, races).quatriemeChoix?.id).toBe("q");
    expect(cardsOnRace("sprintF2", played, races).quatriemeChoix).toBeNull();
  });

  it("Ça farte se pose pendant un 4e choix, pas Aspiration", () => {
    const cards = [...played, card({ id: "f", card_type: "ca_farte" }), card({ id: "a", card_type: "aspiration" })];
    expect(canPlayCard("ca_farte", "poursuiteF", cards, races)).toBe(true);
    expect(canPlayCard("aspiration", "poursuiteF", cards, races)).toBe(false);
    expect(canPlayCard("ca_farte", "relaisMixte", cards, races)).toBe(false);

    // Ça farte et Aspiration ne vont pas sur la même course.
    const farteOnSprint = [card({ id: "f", card_type: "ca_farte", status: "used", used_on_race_id: "sprintF2" }), card({ id: "a", card_type: "aspiration" })];
    expect(canPlayCard("aspiration", "sprintF2", farteOnSprint, races)).toBe(false);

    // Une Aspiration posée plus loin empêche un 4e choix dont la fenêtre la couvrirait, pas un Ça farte.
    const withAspiration = [card({ id: "a", card_type: "aspiration", status: "used", used_on_race_id: "poursuiteH" }), card({ id: "q2" })];
    expect(canPlayCard("balle_de_pioche", "sprintF", withAspiration, races)).toBe(false);
    expect(canPlayCard("balle_de_pioche", "sprintF2", withAspiration, races)).toBe(true);
    const withFarte = [card({ id: "f", card_type: "ca_farte", status: "used", used_on_race_id: "poursuiteH" }), card({ id: "q2" })];
    expect(canPlayCard("balle_de_pioche", "sprintF", withFarte, races)).toBe(true);
  });

  it("refuse une carte qu'on n'a pas", () => {
    expect(canPlayCard("ca_farte", "sprintF", [], races)).toBe(false);
  });
});

describe("resolvePredictionCard", () => {
  const prediction = { athlete_ids: ["a", "b", "c", "d"], bonus_card_target_athlete_id: "b" };

  it("4 choix comptent seulement sous un 4e choix", () => {
    const played = [card({ status: "used", used_on_race_id: "sprintF" })];
    expect(resolvePredictionCard("sprintH", prediction, played, races)).toEqual({
      athleteIds: ["a", "b", "c", "d"],
      card: { type: "balle_de_pioche" },
    });
    expect(resolvePredictionCard("sprintF2", prediction, played, races)).toEqual({ athleteIds: ["a", "b", "c"], card: { type: "none" } });
  });

  it("Ça farte seulement sur la course où la carte a été jouée", () => {
    const played = [card({ card_type: "ca_farte", status: "used", used_on_race_id: "sprintF" })];
    expect(resolvePredictionCard("sprintF", prediction, played, races).card).toEqual({ type: "ca_farte", targetAthleteId: "b" });
    expect(resolvePredictionCard("sprintH", prediction, played, races).card).toEqual({ type: "none" });
  });
});

describe("describeCard", () => {
  const now = new Date(Date.UTC(2026, 11, 3));

  it("disponible, active puis utilisée", () => {
    expect(describeCard(card({}), races, now).state).toBe("available");
    expect(describeCard(card({ status: "used", used_on_race_id: "sprintF" }), races, now)).toMatchObject({
      state: "active",
      windowSize: 4,
      windowStarted: 2,
    });
    const finished = races.map((r) => ({ ...r, status: "finished" }));
    expect(describeCard(card({ status: "used", used_on_race_id: "sprintF" }), finished, now).state).toBe("used");
    expect(describeCard(card({ card_type: "ca_farte", status: "used", used_on_race_id: "sprintF" }), finished, now).state).toBe("used");
  });

  it("crédits restants", () => {
    expect(unclaimedCredits(2, 1)).toBe(1);
    expect(unclaimedCredits(0, 1)).toBe(0);
  });
});

describe("4e choix activé automatiquement", () => {
  it("Ça farte se cumule avec le 4e choix, sur un des 4 choix", () => {
    const cards = [
      card({ id: "q", status: "used", used_on_race_id: "sprintF" }),
      card({ id: "f", card_type: "ca_farte", status: "used", used_on_race_id: "sprintH" }),
    ];
    const prediction = { athlete_ids: ["a", "b", "c", "d"], bonus_card_target_athlete_id: "d" };
    expect(resolvePredictionCard("sprintH", prediction, cards, races)).toEqual({
      athleteIds: ["a", "b", "c", "d"],
      card: { type: "balle_de_pioche", caFarteTargetAthleteId: "d" },
    });
    expect(resolvePredictionCard("poursuiteF", prediction, cards, races).card).toEqual({ type: "balle_de_pioche" });
  });

  it("Aspiration déjà posée l'emporte sur la course que le 4e choix couvre", () => {
    const cards = [
      card({ id: "a", card_type: "aspiration", status: "used", used_on_race_id: "sprintH" }),
      card({ id: "q", status: "used", used_on_race_id: "sprintF" }),
    ];
    const prediction = { athlete_ids: ["a", "b", "c", "d"], bonus_card_target_athlete_id: null };
    expect(resolvePredictionCard("sprintH", prediction, cards, races)).toEqual({ athleteIds: ["a", "b", "c"], card: { type: "aspiration" } });
  });
});

describe("cartes de la saison", () => {
  const stage = (starts_on: string, coefficient = 1, firstLocksAt: string | null = `${starts_on}T12:00:00Z`) => ({
    starts_on,
    coefficient,
    firstLocksAt,
  });
  const stages = [
    stage("2026-11-28"),
    stage("2026-12-05"),
    stage("2026-12-12"),
    stage("2027-01-02"), // 4e étape : Aspiration
    stage("2027-01-09"),
    stage("2027-02-10", 2), // Mondiaux
    stage("2027-03-05"), // étape d'après : Équipe
  ];

  it("Aspiration dès le départ de la 4e étape, Équipe après les Mondiaux", () => {
    expect(isCardUnlocked("fondue", stages, new Date("2026-11-01"))).toBe(true);
    expect(isCardUnlocked("aspiration", stages, new Date("2027-01-02T11:00:00Z"))).toBe(false);
    expect(isCardUnlocked("aspiration", stages, new Date("2027-01-02T12:00:00Z"))).toBe(true);
    expect(isCardUnlocked("equipe", stages, new Date("2027-02-20"))).toBe(false);
    expect(isCardUnlocked("equipe", stages, new Date("2027-03-05T12:00:00Z"))).toBe(true);
  });

  it("sans Mondiaux ni JO, Équipe à la 7e étape", () => {
    const noChamps = stages.map((s) => ({ ...s, coefficient: 1 }));
    expect(isCardUnlocked("equipe", noChamps, new Date("2027-03-05T12:00:00Z"))).toBe(true);
    expect(isCardUnlocked("equipe", noChamps, new Date("2027-02-20"))).toBe(false);
  });

  it("pas la même carte deux 10/10 de suite", () => {
    const offers = offeredCards("ca_farte", stages, new Date("2026-12-01"));
    expect(Object.fromEntries(offers.map((o) => [o.type, o.state]))).toEqual({
      fondue: "offered",
      ca_farte: "justTaken",
      balle_de_pioche: "offered",
      aspiration: "locked",
      equipe: "locked",
    });
  });

  it("Équipe couvre toutes les courses restantes, relais compris", () => {
    const equipe = [card({ id: "e", card_type: "equipe", status: "used", used_on_race_id: "relaisF" })];
    expect(cardsOnRace("sprintH2", equipe, races).equipe?.id).toBe("e");
    expect(cardsOnRace("relaisMixte", equipe, races).equipe?.id).toBe("e");
    expect(cardsOnRace("sprintH", equipe, races).equipe).toBeNull();
  });

  it("Aspiration se joue comme Ça farte, une carte de course à la fois", () => {
    const cards = [card({ id: "a", card_type: "aspiration" }), card({ id: "q", status: "used", used_on_race_id: "sprintF" })];
    expect(canPlayCard("aspiration", "sprintH", cards, races)).toBe(false);
    expect(canPlayCard("aspiration", "sprintF2", cards, races)).toBe(true);
    expect(canPlayCard("aspiration", "relaisF", cards, races)).toBe(false);
    const played = [card({ id: "a", card_type: "aspiration", status: "used", used_on_race_id: "sprintF2" })];
    expect(resolvePredictionCard("sprintF2", { athlete_ids: ["a", "b", "c"], bonus_card_target_athlete_id: null }, played, races).card).toEqual({
      type: "aspiration",
    });
  });
});

describe("computeEquipeBonus", () => {
  it("exemple de Guillaume : France Hommes, sprint d'Oslo", () => {
    // Perrot (pronostiqué) 2e à 8, Jacquelin 4e à 12, Claude 8e à 24 : 8 + 12 + 24 en plus des
    // points du pronostic, que les biathlètes aient été choisis ou non.
    const results = [
      { rank: 1, nationCode: "NOR", sex: "H", odds: 3 },
      { rank: 2, nationCode: "FRA", sex: "H", odds: 8 },
      { rank: 4, nationCode: "FRA", sex: "H", odds: 12 },
      { rank: 8, nationCode: "FRA", sex: "H", odds: 24 },
      { rank: 14, nationCode: "FRA", sex: "H", odds: 30 },
    ];
    expect(computeEquipeBonus({ nationCode: "FRA", sex: "H" }, { format: "sprint", sex: "H" }, results, [])).toBe(44);
  });

  const team = { nationCode: "FRA", sex: "F" };
  const individual = [
    { rank: 2, nationCode: "FRA", sex: "F", odds: 5 },
    { rank: 9, nationCode: "FRA", sex: "F", odds: 20 },
    { rank: 11, nationCode: "FRA", sex: "F", odds: 40 },
    { rank: 1, nationCode: "NOR", sex: "F", odds: 3 },
  ];

  it("une fois la cote de chaque biathlète de l'équipe dans le Top 10", () => {
    expect(computeEquipeBonus(team, { format: "sprint", sex: "F" }, individual, [])).toBe(25);
    expect(computeEquipeBonus(team, { format: "sprint", sex: "H" }, individual, [])).toBe(0);
    expect(computeEquipeBonus(null, { format: "sprint", sex: "F" }, individual, [])).toBe(0);
  });

  it("relais du sexe de l'équipe seulement", () => {
    const relay = [{ rank: 4, nationCode: "FRA", odds: 6 }];
    expect(computeEquipeBonus(team, { format: "relais_f", sex: "F" }, [], relay)).toBe(6);
    expect(computeEquipeBonus(team, { format: "relais_h", sex: "H" }, [], relay)).toBe(0);
    expect(computeEquipeBonus(team, { format: "relais_mixte", sex: null }, [], relay)).toBe(0);
  });
});
