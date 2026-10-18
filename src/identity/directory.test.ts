import { describe, expect, it } from "vitest";
import type { Person } from "@/domain/types";
import { manualDirectory } from "./directory";

const people: Person[] = [
  { id: "p1", name: "林品均", department: "廠務處", active: true, source: "manual", externalId: null },
  { id: "p2", name: "陳浩宇", department: "廠務處", active: true, source: "manual", externalId: null },
  { id: "p3", name: "舊帳號", department: "退休", active: false, source: "external", externalId: "hr-3" },
];

describe("manualDirectory", () => {
  const directory = manualDirectory(people);

  it("lists active people and can include inactive ones", () => {
    expect(directory.listPeople().map((person) => person.id)).toEqual(["p1", "p2"]);
    expect(directory.listPeople({ includeInactive: true })).toHaveLength(3);
  });

  it("searches by name or department", () => {
    expect(directory.searchPeople("浩宇").map((person) => person.id)).toEqual(["p2"]);
    expect(directory.searchPeople("廠務").map((person) => person.id)).toEqual(["p1", "p2"]);
  });

  it("gets a person by id, including inactive records", () => {
    expect(directory.getPerson("p3")?.externalId).toBe("hr-3");
    expect(directory.getPerson("missing")).toBeNull();
  });
});
