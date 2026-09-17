import { describe, expect, it } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { buildSchemaFormatBackfill } from "~/utils/schemaFormatBackfill";

const nodeType = (type: string): DiscourseNode => ({
  type,
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "[[CLM]] - {content}",
});

describe("buildSchemaFormatBackfill", () => {
  it("targets rows without a format that match a local node type", () => {
    const result = buildSchemaFormatBackfill({
      conceptRows: [
        { source_local_id: "schema-1", format: null },
        { source_local_id: "schema-2", format: "[[QUE]] - {content}" },
      ],
      nodeTypes: [nodeType("schema-1"), nodeType("schema-2")],
    });
    expect(result.nodeTypeIdsToBackfill).toEqual(new Set(["schema-1"]));
    expect(result.withFormatCount).toBe(1);
    expect(result.orphanedCount).toBe(0);
  });

  it("treats an empty format as already set", () => {
    const result = buildSchemaFormatBackfill({
      conceptRows: [{ source_local_id: "schema-1", format: "" }],
      nodeTypes: [nodeType("schema-1")],
    });
    expect(result.nodeTypeIdsToBackfill.size).toBe(0);
    expect(result.withFormatCount).toBe(1);
  });

  it("reports rows with no matching local node type as orphaned", () => {
    const result = buildSchemaFormatBackfill({
      conceptRows: [
        { source_local_id: "gone-schema", format: null },
        { source_local_id: "schema-1", format: null },
      ],
      nodeTypes: [nodeType("schema-1")],
    });
    expect(result.nodeTypeIdsToBackfill).toEqual(new Set(["schema-1"]));
    expect(result.orphanedCount).toBe(1);
  });

  it("ignores rows without a source_local_id", () => {
    const result = buildSchemaFormatBackfill({
      conceptRows: [{ source_local_id: null, format: null }],
      nodeTypes: [nodeType("schema-1")],
    });
    expect(result.nodeTypeIdsToBackfill.size).toBe(0);
    expect(result.withFormatCount).toBe(0);
    expect(result.orphanedCount).toBe(0);
  });

  it("returns zero counts for an empty probe", () => {
    const result = buildSchemaFormatBackfill({
      conceptRows: [],
      nodeTypes: [nodeType("schema-1")],
    });
    expect(result.nodeTypeIdsToBackfill.size).toBe(0);
    expect(result.withFormatCount).toBe(0);
    expect(result.orphanedCount).toBe(0);
  });
});
