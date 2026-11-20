import { describe, expect, it } from "vitest";
import {
  diffSchemaIds,
  findIdsMissingSchema,
} from "~/utils/schemaReconciliation";

describe("diffSchemaIds", () => {
  it("marks a database schema that the settings no longer have as stale", () => {
    const { staleSchemaIds } = diffSchemaIds({
      databaseSchemaIds: ["old-source", "claim"],
      localSchemaIds: ["new-source", "claim"],
    });
    expect([...staleSchemaIds]).toEqual(["old-source"]);
  });

  it("marks a settings schema that the database lacks as missing", () => {
    const { missingSchemaIds } = diffSchemaIds({
      databaseSchemaIds: ["old-source", "claim"],
      localSchemaIds: ["new-source", "claim"],
    });
    expect([...missingSchemaIds]).toEqual(["new-source"]);
  });

  it("finds nothing to do when the database matches the settings", () => {
    const { staleSchemaIds, missingSchemaIds } = diffSchemaIds({
      databaseSchemaIds: ["claim", "supports"],
      localSchemaIds: ["supports", "claim"],
    });
    expect(staleSchemaIds.size).toBe(0);
    expect(missingSchemaIds.size).toBe(0);
  });
});

describe("findIdsMissingSchema", () => {
  const typeIds = new Set(["source"]);

  it("selects an item stored with no schema reference whose type is in the settings", () => {
    const ids = findIdsMissingSchema({
      rows: [{ source_local_id: "n1", schema_id: null }],
      items: [{ id: "n1", typeId: "source" }],
      typeIds,
    });
    expect([...ids]).toEqual(["n1"]);
  });

  it("skips an item that already has a schema reference", () => {
    const ids = findIdsMissingSchema({
      rows: [{ source_local_id: "n1", schema_id: 42 }],
      items: [{ id: "n1", typeId: "source" }],
      typeIds,
    });
    expect(ids.size).toBe(0);
  });

  it("skips an item whose type is not in the settings, since sending it again cannot give it a schema", () => {
    const ids = findIdsMissingSchema({
      rows: [{ source_local_id: "n1", schema_id: null }],
      items: [{ id: "n1", typeId: "deleted-type" }],
      typeIds,
    });
    expect(ids.size).toBe(0);
  });

  it("skips a stored row that has no matching local item", () => {
    const ids = findIdsMissingSchema({
      rows: [{ source_local_id: "gone", schema_id: null }],
      items: [],
      typeIds,
    });
    expect(ids.size).toBe(0);
  });
});
