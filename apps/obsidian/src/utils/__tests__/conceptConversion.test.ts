import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import type { DiscourseNode } from "~/types";
import type { SupabaseContext } from "~/utils/supabaseContext";
import type { ObsidianDiscourseNodeData } from "~/utils/syncDgNodesToSupabase";
import { discourseNodeInstanceToLocalConcept } from "~/utils/conceptConversion";

const CONTEXT: SupabaseContext = {
  spaceId: 1,
  platform: "Obsidian",
  userId: 1,
  spacePassword: "test",
};

const NODE_TYPES_BY_ID: Record<string, DiscourseNode> = {
  "evidence-type": {
    id: "evidence-type",
    name: "Evidence",
    format: "EVD - {content}",
    created: 0,
    modified: 0,
  },
};

const evidenceNode = (sourceDocument?: string): ObsidianDiscourseNodeData => ({
  file: {
    basename: "EVD - Evidence title",
    path: "EVD - Evidence title.md",
    stat: { ctime: 0, mtime: 0 },
  } as unknown as TFile,
  frontmatter: { nodeInstanceId: "evidence", nodeTypeId: "evidence-type" },
  nodeTypeId: "evidence-type",
  nodeInstanceId: "evidence",
  created: "1970-01-01T00:00:00.000Z",
  last_modified: "1970-01-01T00:00:00.000Z",
  changeTypes: [],
  sourceDocument,
});

describe("discourseNodeInstanceToLocalConcept", () => {
  it("publishes the Source with the core title", () => {
    const concept = discourseNodeInstanceToLocalConcept({
      context: CONTEXT,
      nodeData: evidenceNode("source"),
      nodeTypesById: NODE_TYPES_BY_ID,
    });
    expect(concept.literal_content).toMatchObject({
      label: "EVD - Evidence title",
      core_title: "Evidence title",
    });
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "source",
    });
  });

  it("omits reference content when the node has no Source", () => {
    const concept = discourseNodeInstanceToLocalConcept({
      context: CONTEXT,
      nodeData: evidenceNode(),
      nodeTypesById: NODE_TYPES_BY_ID,
    });
    expect(concept).not.toHaveProperty("local_reference_content");
  });
});
