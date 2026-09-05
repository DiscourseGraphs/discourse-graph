import { describe, expect, it } from "vitest";
import type { RelationInstance } from "~/types";
import {
  buildEndpointIndex,
  collectRelations,
} from "~/utils/relationsEndpointIndex";

const relation = (
  overrides: Partial<RelationInstance> & Pick<RelationInstance, "id">,
): RelationInstance => ({
  type: "supports",
  source: "a",
  destination: "b",
  created: 0,
  ...overrides,
});

const toRecord = (
  relations: RelationInstance[],
): Record<string, RelationInstance> =>
  Object.fromEntries(relations.map((r) => [r.id, r]));

describe("buildEndpointIndex", () => {
  it("files a relation under both endpoints", () => {
    const r = relation({ id: "r1", source: "a", destination: "b" });
    const index = buildEndpointIndex(toRecord([r]));

    expect(index.get("a")).toEqual([r]);
    expect(index.get("b")).toEqual([r]);
  });

  it("files a self-relation once so one endpoint does not yield it twice", () => {
    const r = relation({ id: "r1", source: "a", destination: "a" });
    const index = buildEndpointIndex(toRecord([r]));

    expect(index.get("a")).toEqual([r]);
  });

  it("groups multiple relations sharing an endpoint", () => {
    const r1 = relation({ id: "r1", source: "a", destination: "b" });
    const r2 = relation({ id: "r2", source: "c", destination: "a" });
    const index = buildEndpointIndex(toRecord([r1, r2]));

    expect(index.get("a")).toEqual([r1, r2]);
    expect(index.get("b")).toEqual([r1]);
    expect(index.get("c")).toEqual([r2]);
  });

  it("returns an empty index for no relations", () => {
    expect(buildEndpointIndex({}).size).toBe(0);
  });

  it("skips relations missing an endpoint rather than indexing undefined", () => {
    const r = relation({ id: "r1", source: "a", destination: "" });
    const index = buildEndpointIndex(toRecord([r]));

    expect(index.get("a")).toEqual([r]);
    expect(index.has("")).toBe(false);
    expect(index.size).toBe(1);
  });
});

describe("collectRelations", () => {
  it("returns relations for a single endpoint", () => {
    const r1 = relation({ id: "r1", source: "a", destination: "b" });
    const r2 = relation({ id: "r2", source: "c", destination: "d" });
    const index = buildEndpointIndex(toRecord([r1, r2]));

    expect(collectRelations({ index, endpointIds: ["a"] })).toEqual([r1]);
  });

  it("counts a relation once when both its endpoints are queried", () => {
    // An imported node matches on both its nodeInstanceId and its
    // importedFromRid, so both ends of the same relation can be asked for.
    const r = relation({ id: "r1", source: "local-id", destination: "rid" });
    const index = buildEndpointIndex(toRecord([r]));

    expect(
      collectRelations({ index, endpointIds: ["local-id", "rid"] }),
    ).toEqual([r]);
  });

  it("deduplicates across endpoints while preserving first-seen order", () => {
    const r1 = relation({ id: "r1", source: "a", destination: "shared" });
    const r2 = relation({ id: "r2", source: "b", destination: "shared" });
    const index = buildEndpointIndex(toRecord([r1, r2]));

    expect(
      collectRelations({ index, endpointIds: ["shared", "a", "b"] }).map(
        (r) => r.id,
      ),
    ).toEqual(["r1", "r2"]);
  });

  it("returns an empty array for unknown endpoints", () => {
    const index = buildEndpointIndex(
      toRecord([relation({ id: "r1", source: "a", destination: "b" })]),
    );

    expect(collectRelations({ index, endpointIds: ["nope"] })).toEqual([]);
    expect(collectRelations({ index, endpointIds: [] })).toEqual([]);
  });
});
