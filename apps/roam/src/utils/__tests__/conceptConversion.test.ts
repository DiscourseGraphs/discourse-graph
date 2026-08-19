import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseContext } from "~/utils/supabaseContext";

vi.mock("~/utils/getBlockProps", () => ({ default: () => ({}) }));
vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: () => [] }));
vi.mock("~/utils/createReifiedBlock", () => ({
  DISCOURSE_GRAPH_PROP_NAME: "discourse-graph",
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: () => "",
}));

import { discourseNodeBlockToLocalConcept } from "~/utils/conceptConversion";

const context = { spaceId: 42 } as SupabaseContext;

describe("discourseNodeBlockToLocalConcept", () => {
  beforeEach(() => {
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        q: () => [["author-1", "page-1", 1000, 2000]],
      },
    };
  });

  it("writes the core title into literal_content", () => {
    const concept = discourseNodeBlockToLocalConcept(context, {
      nodeUid: "node-1",
      schemaUid: "schema-1",
      text: "CLM - my claim",
      coreTitle: "my claim",
    });
    expect(concept.literal_content).toEqual({ core_title: "my claim" });
    expect(concept.name).toBe("CLM - my claim");
    expect(concept.source_local_id).toBe("node-1");
  });
});
