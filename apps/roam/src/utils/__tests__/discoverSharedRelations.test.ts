import { describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { discoverSharedRelations } from "~/utils/discoverSharedRelations";

vi.mock("~/utils/importedSourceIdentity", () => ({
  getImportedSourceRids: () =>
    Promise.resolve(
      new Set(["orn:obsidian.note:vault-a/x", "orn:obsidian.note:vault-a/y"]),
    ),
}));
vi.mock("@repo/database/lib/dbToCrossAppConverters", () => ({
  getSpaceMap: () => Promise.resolve({ 20: "obsidian:vault-a" }),
}));

// Each `from` call answers with the next queued result, whatever the filters.
const fakeClient = (results: unknown[][]): DGSupabaseClient => {
  const from = () => {
    const data = results.shift();
    const query: Record<string, unknown> = {};
    for (const method of ["select", "neq", "eq", "in", "overlaps"])
      query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data, error: null });
    return query;
  };
  return { from } as unknown as DGSupabaseClient;
};

describe("discoverSharedRelations", () => {
  it("skips a relation whose schema is not visible and reports it", async () => {
    const relation = {
      id: 300,
      space_id: 20,
      source_local_id: "rel-1",
      schema_id: 99,
      is_schema: false,
      is_relation: true,
      reference_content: { source: 1, destination: 2 },
      concepts_of_relation: [
        { id: 1, space_id: 20, source_local_id: "x", schema_id: 10 },
        { id: 2, space_id: 20, source_local_id: "y", schema_id: 11 },
      ],
    };
    const client = fakeClient([[relation], []]);

    const result = await discoverSharedRelations(client, 7);

    expect(result.relations).toEqual([]);
    expect(result.skippedRelations).toEqual([
      "orn:obsidian.relation:vault-a/rel-1: its relation type is not visible",
    ]);
  });
});
