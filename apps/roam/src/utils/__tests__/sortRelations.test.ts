import { describe, expect, it } from "vitest";
import {
  getNextRelationSort,
  sortRelations,
  type RelationSort,
} from "~/utils/sortRelations";

const relations = [
  { uid: "1", source: "evidence", text: "Supports", destination: "claim" },
  { uid: "2", source: "flow", text: "Part of", destination: "artifact" },
  { uid: "3", source: "issue", text: "Addresses", destination: "claim" },
];

const labelsByType = {
  evidence: { label: "Evidence" },
  flow: { label: "Flow" },
  issue: { label: "Issue" },
  claim: { label: "Claim" },
  artifact: { label: "Artifact" },
};

const getSortedUids = (sort: RelationSort): string[] =>
  sortRelations({ relations, sort, labelsByType }).map(({ uid }) => uid);

describe("sortRelations", () => {
  it.each([
    ["source", ["1", "2", "3"]],
    ["relation", ["3", "2", "1"]],
    ["destination", ["2", "1", "3"]],
  ] as const)("sorts ascending by %s", (column, expected) => {
    expect(getSortedUids({ column, direction: "ascending" })).toEqual(expected);
  });

  it("sorts descending without mutating the original relations", () => {
    expect(
      getSortedUids({ column: "source", direction: "descending" }),
    ).toEqual(["3", "2", "1"]);
    expect(relations.map(({ uid }) => uid)).toEqual(["1", "2", "3"]);
  });
});

describe("getNextRelationSort", () => {
  it("cycles an active column from ascending to descending to default", () => {
    expect(
      getNextRelationSort({ currentSort: null, column: "source" }),
    ).toEqual({ column: "source", direction: "ascending" });
    expect(
      getNextRelationSort({
        currentSort: { column: "source", direction: "ascending" },
        column: "source",
      }),
    ).toEqual({ column: "source", direction: "descending" });
    expect(
      getNextRelationSort({
        currentSort: { column: "source", direction: "descending" },
        column: "source",
      }),
    ).toBeNull();
  });

  it("starts a different column ascending", () => {
    expect(
      getNextRelationSort({
        currentSort: { column: "source", direction: "descending" },
        column: "relation",
      }),
    ).toEqual({ column: "relation", direction: "ascending" });
  });
});
