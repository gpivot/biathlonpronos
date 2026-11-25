import { describe, expect, it } from "vitest";
import { extractNextPageProps, guessRaceId, ibuRowsToStartList } from "../admin/ibuResults";

describe("repli biathlonworld.com", () => {
  it("lit la liste de départ embarquée dans la page", () => {
    const data = {
      props: {
        pageProps: {
          startlistInitialState: {
            RaceId: "BT2627SWRLCP01SMIN",
            Results: [
              { StartOrder: 2, Bib: "2", FamilyName: "FAK", GivenName: "Jakov", Nat: "SLO", IsTeam: false, Leg: null },
              { StartOrder: 1, Bib: "1", FamilyName: "JEFFERIES", GivenName: "Jacques", Nat: "GBR", IsTeam: false, Leg: null },
            ],
          },
        },
      },
    };
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
    const props = extractNextPageProps(html);
    const entries = ibuRowsToStartList(props?.startlistInitialState.Results);
    expect(entries.map((e) => e.lastName)).toEqual(["JEFFERIES", "FAK"]);
    expect(entries[0]).toMatchObject({ position: 1, bib: 1, nation: "GBR" });
  });

  it("renvoie null sur une page sans données", () => {
    expect(extractNextPageProps("<html></html>")).toBeNull();
    expect(extractNextPageProps('<script id="__NEXT_DATA__">{oops</script>')).toBeNull();
  });

  it("déduit l'identifiant IBU de la course", () => {
    expect(guessRaceId("BT2627SWRLCP01", { format: "individuel", sex: "M" })).toBe("BT2627SWRLCP01SMIN");
    expect(guessRaceId("BT2627SWRLCP01", { format: "sprint", sex: "F" })).toBe("BT2627SWRLCP01SWSP");
    expect(guessRaceId("BT2627SWRLCP01", { format: "relais_mixte_simple", sex: null })).toBe("BT2627SWRLCP01MXSR");
    expect(guessRaceId("BT2627SWRLCP01", { format: "inconnu", sex: null })).toBeNull();
  });
});
