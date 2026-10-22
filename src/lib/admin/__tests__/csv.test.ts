import { describe, expect, it } from "vitest";
import { buildOddsCsv, parseOddsCsv } from "../oddsCsv";
import { buildResultsCsv, parseResultsCsv, parseTimeGap } from "../resultsCsv";
import { buildCalendarCsv } from "../calendarImport";
import { parseCsv } from "../csv";

const ODDS_FILE = `Type;Nation;Sexe;Nom;Prénom;Relais mixte;Relais mixte simple;Relais;Meilleure nation;Sprint;Poursuite;Individuel;Mass start;Globe;Jeune
Nation;FRA;;;;2;3
Équipe;FRA;F;;;;;2;3
Athlète;FRA;F;Simon;Julia;;;;;2;2;3;2;3;
Athlète;FRA;F;Jeanmonnot;Lou;;;;;3;3;3;3;4;
Équipe;FRA;H;;;;;3;2
Athlète;FRA;H;Perrot;Éric;;;;;2;2;2;2;2;3
Nation;NOR;;;;1;1
`;

describe("parseOddsCsv", () => {
  it("lit les lignes nation, équipe et athlète dans le format demandé", () => {
    const parsed = parseOddsCsv(ODDS_FILE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.athletes).toHaveLength(3);
    expect(parsed.athletes[2]).toMatchObject({ firstName: "Éric", lastName: "Perrot", sex: "H", nationCode: "FRA" });
    expect(parsed.athletes[2].odds).toContainEqual({ format: "meilleur_jeune", value: 3 });
    expect(parsed.nationOdds).toContainEqual({ nationCode: "FRA", nationSex: null, format: "relais_mixte", value: 2 });
    expect(parsed.nationOdds).toContainEqual({ nationCode: "FRA", nationSex: "F", format: "relais_f", value: 2 });
    expect(parsed.nationOdds).toContainEqual({ nationCode: "FRA", nationSex: "H", format: "relais_h", value: 3 });
    expect(parsed.nationOdds).toContainEqual({ nationCode: "FRA", nationSex: "H", format: "meilleure_nation", value: 2 });
    expect(parsed.nationOdds).toContainEqual({ nationCode: "NOR", nationSex: null, format: "relais_mixte_simple", value: 1 });
  });

  it("déduit le type de ligne quand la colonne Type est vide", () => {
    const parsed = parseOddsCsv("Nation,Sexe,Nom,Prénom,Relais mixte,Relais,Sprint\nITA,,,,4\nITA,F,,,,3\nITA,F,Wierer,Dorothea,,,2\n");
    expect(parsed.errors).toEqual([]);
    expect(parsed.athletes).toHaveLength(1);
    expect(parsed.nationOdds).toHaveLength(2);
  });

  it("bloque l'import sur une cote invalide, un doublon ou un sexe manquant", () => {
    const parsed = parseOddsCsv(
      "Type;Nation;Sexe;Nom;Prénom;Sprint\nAthlète;FRA;F;Simon;Julia;2,5\nAthlète;FRA;F;Simon;Julia;2\nÉquipe;FRA;;;;\n"
    );
    expect(parsed.errors).toHaveLength(3);
  });

  it("refuse un fichier sans cote (évite d'effacer les cotes en cours)", () => {
    expect(parseOddsCsv("Type;Nation;Sexe;Nom;Prénom\n").errors).not.toEqual([]);
  });

  it("signale une cote dans une colonne qui ne correspond pas au type de ligne", () => {
    const parsed = parseOddsCsv("Type;Nation;Sexe;Nom;Prénom;Sprint\nNation;FRA;;;;2\nÉquipe;FRA;F;;;\n");
    expect(parsed.warnings).toHaveLength(1);
  });
});

describe("buildOddsCsv", () => {
  it("produit un fichier réimportable à l'identique, nation puis femmes puis hommes", () => {
    const csv = buildOddsCsv({
      nations: [{ code: "FRA", name: "France" }],
      athletes: [
        { id: "a1", first_name: "Éric", last_name: "Perrot", nation_code: "FRA", sex: "H" },
        { id: "a2", first_name: "Julia", last_name: "Simon", nation_code: "FRA", sex: "F" },
        { id: "a3", first_name: "Sans", last_name: "Cote", nation_code: "FRA", sex: "F" },
      ],
      odds: [
        { format: "relais_mixte", value: 2, athlete_id: null, nation_code: "FRA", nation_sex: null },
        { format: "relais_f", value: 2, athlete_id: null, nation_code: "FRA", nation_sex: "F" },
        { format: "sprint", value: 2, athlete_id: "a1", nation_code: null, nation_sex: null },
        { format: "sprint", value: 3, athlete_id: "a2", nation_code: null, nation_sex: null },
      ],
    });
    const rows = parseCsv(csv);
    expect(rows.map((r) => r["type"])).toEqual(["Nation", "Équipe", "Athlète", "Équipe", "Athlète"]);
    expect(rows[2]["nom"]).toBe("Simon");

    const reparsed = parseOddsCsv(csv);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.athletes.map((a) => a.lastName)).toEqual(["Simon", "Perrot"]);
    expect(reparsed.nationOdds).toHaveLength(2);
  });
});

describe("parseResultsCsv", () => {
  const candidates = [
    { id: "a1", firstName: "Julia", lastName: "Simon", nationCode: "FRA" },
    { id: "a2", firstName: "Lou", lastName: "Jeanmonnot", nationCode: "FRA" },
    { id: "a3", firstName: "Elvira", lastName: "Öberg", nationCode: "SWE" },
  ];

  it("retrouve les athlètes par nom (accents, casse, ordre) et lit écart, fusée, gâchette", () => {
    const parsed = parseResultsCsv(
      "Rang;Nom;Prénom;Nation;Écart (s);Fusée;Gâchette\n1;SIMON;Julia;FRA;;oui;oui\n2;Oberg;Elvira;SWE;+1:02.5;;non\nDNF;Jeanmonnot;Lou;FRA;;;\n",
      "athlete",
      candidates
    );
    expect(parsed.matched).toBe(2);
    expect(parsed.rows.a1).toEqual({ rank: "1", timeGapSeconds: "0", penaltyLaps: "", isFusee: true, isGachette: true });
    expect(parsed.rows.a3.timeGapSeconds).toBe("62.5");
    expect(parsed.rows.a2).toBeUndefined();
    expect(parsed.warnings).toHaveLength(1);
  });

  it("accepte une colonne Athlète unique et une colonne Fautes", () => {
    const parsed = parseResultsCsv("Rang,Athlète,Fautes\n1,Lou Jeanmonnot,0\n2,Inconnue Personne,1\n", "athlete", candidates);
    expect(parsed.rows.a2.isGachette).toBe(true);
    expect(parsed.warnings).toHaveLength(1);
  });

  it("relais : retrouve la nation par code ou par nom", () => {
    const parsed = parseResultsCsv("Rang;Nation\n1;Norvège\n2;FRA\n", "nation", [
      { id: "NOR", nationCode: "NOR", nationName: "Norvège" },
      { id: "FRA", nationCode: "FRA", nationName: "France" },
    ]);
    expect(parsed.rows.NOR.rank).toBe("1");
    expect(parsed.rows.FRA.rank).toBe("2");
  });

  it("le modèle exporté se réimporte", () => {
    const csv = buildResultsCsv("athlete", candidates, {
      a2: { rank: "1", timeGapSeconds: "0", penaltyLaps: "", isFusee: false, isGachette: true },
    });
    const parsed = parseResultsCsv(csv, "athlete", candidates);
    expect(parsed.matched).toBe(1);
    expect(parsed.rows.a2.isGachette).toBe(true);
  });
});

describe("parseTimeGap", () => {
  it("convertit les écarts usuels en secondes", () => {
    expect(parseTimeGap("12,3")).toBe(12.3);
    expect(parseTimeGap("+1:02.5")).toBe(62.5);
    expect(parseTimeGap("1:00:00")).toBe(3600);
    expect(parseTimeGap("")).toBeNull();
    expect(parseTimeGap("abc")).toBeNull();
  });
});

describe("buildCalendarCsv", () => {
  it("reprend les en-têtes de l'import, une ligne par course triée par date", () => {
    const csv = buildCalendarCsv([
      {
        location: "Otepää",
        country_code: "EST",
        coefficient: 2,
        races: [
          { format: "relais_f", sex: null, locks_at: "2027-02-14T13:15:00+00:00" },
          { format: "sprint", sex: "H", locks_at: "2027-02-12T14:30:00+00:00" },
        ],
      },
    ]);
    const rows = parseCsv(csv);
    expect(rows[0]).toMatchObject({
      "lieu (ville)": "Otepää",
      "pays (pour code drapeau)": "EE",
      date: "2027-02-12",
      "heure de depart utc": "14:30",
      categorie: "Championnats du Monde",
      "type de course": "Sprint",
      sexe: "Hommes",
    });
    expect(rows[1]).toMatchObject({ "type de course": "Relais", sexe: "Femmes" });
  });
});
