import { describe, expect, it, vi } from "vitest";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: () => "",
}));
vi.mock("~/utils/pageToMarkdown", () => ({ toMarkdown: () => "" }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: () => [] }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [SOURCE_TYPE],
}));

// Sync reads the author through q, publish through pull; both see one creator.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: {
      util: { generateUID: () => "someUid" },
      q: () => [["author-1", "page-1", 1000, 2000]],
      pull: () => ({
        ":create/time": 1000,
        ":page/edit-time": 2000,
        ":create/user": { ":user/uid": "author-1" },
      }),
    },
  };
});

import { crossAppNodeSchemaToDbConcept } from "@repo/database/lib/crossAppConverters";
import { discourseNodeSchemaToLocalConcept } from "~/utils/conceptConversion";
import { nodeSchemaToCrossApp } from "~/utils/roamToCrossAppConverters";

const CONTEXT = { spaceId: 1, userId: 2 } as never;

const nodeType = (overrides: Partial<DiscourseNode>): DiscourseNode => ({
  text: "Evidence",
  type: "_EVD-node",
  shortcut: "e",
  format: "[[EVD]] - {content} - {Source}",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  ...overrides,
});

const SOURCE_TYPE = nodeType({
  text: "Source",
  type: "src-node",
  format: "@{content}",
});

// Timestamps and space fields are transport details that differ by path.
const schemaMetadata = (concept: LocalConceptDataInput) => ({
  name: concept.name,
  source_local_id: concept.source_local_id,
  author_local_id: concept.author_local_id,
  literal_content: concept.literal_content,
  local_reference_content: concept.local_reference_content,
});

const viaSync = (node: DiscourseNode) =>
  schemaMetadata(discourseNodeSchemaToLocalConcept(CONTEXT, node));

const viaPublish = (node: DiscourseNode) => {
  const schema = nodeSchemaToCrossApp(node);
  if (!schema) throw new Error("publish produced no schema");
  return schemaMetadata(crossAppNodeSchemaToDbConcept(schema));
};

describe("node schema metadata from sync and publish", () => {
  it.each([
    [
      "a template and a source slot",
      nodeType({
        template: [{ text: "Question:", children: [{ text: "Answer" }] }],
      }),
    ],
    ["a source slot and no template", nodeType({})],
    [
      "a template and no source slot",
      nodeType({
        text: "Claim",
        type: "clm",
        format: "[[CLM]] - {content}",
        template: [{ text: "Grounds:" }],
      }),
    ],
    [
      "neither a template nor a source slot",
      nodeType({ text: "Claim", type: "clm", format: "[[CLM]] - {content}" }),
    ],
    [
      "a template of only components",
      nodeType({ template: [{ text: "{{x}}" }] }),
    ],
    ["a slash-separated name", nodeType({ text: "Evidence/Figure" })],
  ])("match for a schema with %s", (_label, node) => {
    expect(viaPublish(node)).toEqual(viaSync(node));
  });

  it("both carry the creator as author_local_id", () => {
    expect(viaSync(nodeType({})).author_local_id).toBe("author-1");
    expect(viaPublish(nodeType({})).author_local_id).toBe("author-1");
  });
});
