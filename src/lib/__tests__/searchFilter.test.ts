import { describe, expect, it } from "vitest";
import { filterBySearch } from "../searchFilter";

const athletes = [
  { first: "Lou", last: "Jeanmonnot", nation: "FRA" },
  { first: "Julia", last: "Simon", nation: "FRA" },
  { first: "Franziska", last: "Preuss", nation: "GER" },
  { first: "Johannes Thingnes", last: "Bø", nation: "NOR" },
  { first: "Elvira", last: "Öberg", nation: "SWE" },
];
const search = (q: string) =>
  filterBySearch(
    athletes,
    q,
    (a) => [a.first, a.last, a.nation],
    (a) => a.nation,
  ).map((a) => a.last);

describe("filterBySearch", () => {
  it("laisse tout passer sans recherche", () => {
    expect(search("")).toHaveLength(5);
    expect(search("   ")).toHaveLength(5);
  });
  it("trouve par nom ou prénom, sans casse ni accents", () => {
    expect(search("jeanmon")).toEqual(["Jeanmonnot"]);
    expect(search("JULIA")).toEqual(["Simon"]);
    expect(search("oberg")).toEqual(["Öberg"]);
    expect(search("bø")).toEqual(["Bø"]);
  });
  it("un code pays exact ne garde que ce pays", () => {
    expect(search("fra")).toEqual(["Jeanmonnot", "Simon"]);
    expect(search("NOR")).toEqual(["Bø"]);
  });
  it("un début de nom qui n'est pas un code reste une recherche de nom", () => {
    expect(search("fr")).toEqual(["Jeanmonnot", "Simon", "Preuss"]);
    expect(search("fran")).toEqual(["Preuss"]);
  });
  it("exige chaque mot tapé", () => {
    expect(search("lou fra")).toEqual(["Jeanmonnot"]);
    expect(search("lou nor")).toEqual([]);
  });
});
