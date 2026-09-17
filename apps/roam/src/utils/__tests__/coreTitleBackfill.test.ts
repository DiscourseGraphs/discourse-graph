import { describe, expect, it } from "vitest";
import {
  buildCoreTitleBackfill,
  mergeNodesBySourceLocalId,
} from "../coreTitleBackfill";
import type { RoamDiscourseNodeData } from "../getAllDiscourseNodesSince";

const node = (sourceLocalId: string): RoamDiscourseNodeData => ({
  author_local_id: "author",
  author_name: "Author",
  source_local_id: sourceLocalId,
  created: "1",
  last_modified: "2",
  text: `CLM - ${sourceLocalId}`,
  type: "claim-type",
});

describe("buildCoreTitleBackfill", () => {
  it("forces in local nodes whose row has no core_title", () => {
    const backfill = buildCoreTitleBackfill({
      conceptRows: [
        { source_local_id: "a", core_title: null },
        { source_local_id: "b", core_title: "already set" },
      ],
      localNodes: [node("a"), node("b")],
    });

    expect(backfill.nodesToBackfill.map((n) => n.source_local_id)).toEqual([
      "a",
    ]);
    expect(backfill.withCoreTitleCount).toBe(1);
    expect(backfill.orphanedCount).toBe(0);
  });

  it("reports rows that are no longer in the graph as orphaned", () => {
    const backfill = buildCoreTitleBackfill({
      conceptRows: [
        { source_local_id: "a", core_title: null },
        { source_local_id: "gone", core_title: null },
      ],
      localNodes: [node("a")],
    });

    expect(backfill.nodesToBackfill.map((n) => n.source_local_id)).toEqual([
      "a",
    ]);
    expect(backfill.orphanedCount).toBe(1);
  });

  it("skips rows without a source_local_id", () => {
    const backfill = buildCoreTitleBackfill({
      conceptRows: [{ source_local_id: null, core_title: null }],
      localNodes: [node("a")],
    });

    expect(backfill.nodesToBackfill).toEqual([]);
    expect(backfill.withCoreTitleCount).toBe(0);
    expect(backfill.orphanedCount).toBe(0);
  });

  it("is a no-op once every row has a core_title", () => {
    const backfill = buildCoreTitleBackfill({
      conceptRows: [
        { source_local_id: "a", core_title: "a" },
        { source_local_id: "b", core_title: "b" },
      ],
      localNodes: [node("a"), node("b")],
    });

    expect(backfill.nodesToBackfill).toEqual([]);
    expect(backfill.withCoreTitleCount).toBe(2);
    expect(backfill.orphanedCount).toBe(0);
  });
});

describe("mergeNodesBySourceLocalId", () => {
  it("appends nodes that are not already in the batch", () => {
    const merged = mergeNodesBySourceLocalId(
      [node("a")],
      [node("b"), node("c")],
    );

    expect(merged.map((n) => n.source_local_id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the original node when both batches hold the same id", () => {
    const original = node("a");
    const merged = mergeNodesBySourceLocalId([original], [node("a")]);

    expect(merged).toEqual([original]);
  });
});
