import { describe, expect, it } from "vitest";
import type { RelationInstance } from "~/types";
import {
  countAcceptedRelations,
  getEndpointIdsFromFrontmatter,
  getNodeTypeIdFromFrontmatter,
} from "~/utils/discourseLinkFrontmatter";

const relation = (
  overrides: Partial<RelationInstance> & Pick<RelationInstance, "id">,
): RelationInstance => ({
  type: "supports",
  source: "a",
  destination: "b",
  created: 0,
  ...overrides,
});

describe("getNodeTypeIdFromFrontmatter", () => {
  it("returns the node type id", () => {
    expect(getNodeTypeIdFromFrontmatter({ nodeTypeId: "claim" })).toBe("claim");
  });

  it("returns undefined when absent, empty, undefined frontmatter, or not a string", () => {
    expect(getNodeTypeIdFromFrontmatter({})).toBeUndefined();
    expect(getNodeTypeIdFromFrontmatter({ nodeTypeId: "" })).toBeUndefined();
    expect(getNodeTypeIdFromFrontmatter(undefined)).toBeUndefined();
    expect(getNodeTypeIdFromFrontmatter({ nodeTypeId: 42 })).toBeUndefined();
  });
});

describe("getEndpointIdsFromFrontmatter", () => {
  it("returns the nodeInstanceId for a local node", () => {
    expect(getEndpointIdsFromFrontmatter({ nodeInstanceId: "n1" })).toEqual([
      "n1",
    ]);
  });

  it("returns both ids for an imported node", () => {
    expect(
      getEndpointIdsFromFrontmatter({
        nodeInstanceId: "n1",
        importedFromRid: "rid1",
      }),
    ).toEqual(["n1", "rid1"]);
  });

  it("does not repeat an id when both fields match", () => {
    expect(
      getEndpointIdsFromFrontmatter({
        nodeInstanceId: "same",
        importedFromRid: "same",
      }),
    ).toEqual(["same"]);
  });

  it("returns an importedFromRid even without a nodeInstanceId", () => {
    expect(getEndpointIdsFromFrontmatter({ importedFromRid: "rid1" })).toEqual([
      "rid1",
    ]);
  });

  it("returns nothing for absent or non-string ids", () => {
    expect(getEndpointIdsFromFrontmatter({})).toEqual([]);
    expect(getEndpointIdsFromFrontmatter(undefined)).toEqual([]);
    expect(getEndpointIdsFromFrontmatter({ nodeInstanceId: 7 })).toEqual([]);
  });
});

describe("countAcceptedRelations", () => {
  it("counts local relations, which leave tentative undefined", () => {
    expect(
      countAcceptedRelations([relation({ id: "r1" }), relation({ id: "r2" })]),
    ).toBe(2);
  });

  it("counts explicitly accepted relations", () => {
    expect(
      countAcceptedRelations([relation({ id: "r1", tentative: true })]),
    ).toBe(1);
  });

  it("excludes imported relations awaiting acceptance", () => {
    expect(
      countAcceptedRelations([
        relation({ id: "r1" }),
        relation({ id: "r2", tentative: false }),
      ]),
    ).toBe(1);
  });

  it("returns zero for no relations", () => {
    expect(countAcceptedRelations([])).toBe(0);
  });
});
