import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { ImportedSourceIdentity } from "~/utils/importedSourceIdentity";

const {
  mockedGetPageUidByPageTitle,
  mockedGetDiscourseNodes,
  mockedReadImportedSourceIdentity,
} = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mockedGetPageUidByPageTitle: vi.fn((_title: string) => ""),
  mockedGetDiscourseNodes: vi.fn((): DiscourseNode[] => []),
  mockedReadImportedSourceIdentity: vi.fn(
    (): ImportedSourceIdentity | undefined => undefined,
  ),
}));
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: mockedGetPageUidByPageTitle,
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  readImportedSourceIdentity: mockedReadImportedSourceIdentity,
}));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: mockedGetDiscourseNodes,
}));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: () => [] }));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: () => "",
}));

// getNodeExtraData queries Roam for the author and timestamps of every concept.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: {
      util: { generateUID: () => "someUid" },
      q: () => [["author-1", "page-1", 1000, 2000]],
    },
  };
});

import { discourseNodeSchemaToLocalConcept } from "~/utils/conceptConversion";

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

// Roam-like lookup: only pages that exist resolve to a uid.
const PAGE_UIDS: Record<string, string> = {
  "@sun2019direct": "source-1",
  "@sun2019direct/fig2": "source-2",
};

beforeEach(() => {
  mockedGetPageUidByPageTitle.mockReset();
  mockedGetPageUidByPageTitle.mockImplementation(
    (title: string) => PAGE_UIDS[title] ?? "",
  );
  mockedGetDiscourseNodes.mockReturnValue([SOURCE_TYPE]);
  mockedReadImportedSourceIdentity.mockReset();
});

describe("discourseNodeSchemaToLocalConcept source slot", () => {
  it("declares a sourceDocument slot filled by the Source node type", () => {
    const concept = discourseNodeSchemaToLocalConcept(CONTEXT, nodeType({}));
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "src-node",
    });
    expect(concept.literal_content).toMatchObject({
      roles: ["sourceDocument"],
    });
  });

  it("falls back to the default source type when none is configured", () => {
    mockedGetDiscourseNodes.mockReturnValue([]);
    const concept = discourseNodeSchemaToLocalConcept(CONTEXT, nodeType({}));
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "_SRC-node",
    });
  });

  it("declares no slot when the format has no source placeholder", () => {
    const concept = discourseNodeSchemaToLocalConcept(
      CONTEXT,
      nodeType({ text: "Claim", type: "clm", format: "[[CLM]] - {content}" }),
    );
    expect(concept.local_reference_content).toBeUndefined();
    expect(concept.literal_content).toEqual({
      label: "Claim",
      format: "[[CLM]] - {content}",
    });
  });

  // Not covered: an upsert whose author_local_id doesn't resolve nulls author_id.
  it("carries the type author as author_local_id", () => {
    const concept = discourseNodeSchemaToLocalConcept(CONTEXT, nodeType({}));
    expect(concept.author_local_id).toBe("author-1");
  });
});

describe("discourseNodeSchemaToLocalConcept label and template", () => {
  it("writes the template body to template_content, with no template title", () => {
    const concept = discourseNodeSchemaToLocalConcept(
      CONTEXT,
      nodeType({
        template: [{ text: "Question:", children: [{ text: "Answer" }] }],
      }),
    );
    expect(concept.literal_content).toEqual({
      label: "Evidence",
      format: "[[EVD]] - {content} - {Source}",
      template_content: "* Question:\n   * Answer\n   \n",
      roles: ["sourceDocument"],
    });
  });

  it.each([
    ["no template", undefined],
    ["an empty template", []],
    ["a template of only components", [{ text: "{{query block}}" }]],
  ])("omits template_content for %s", (_label, template) => {
    const concept = discourseNodeSchemaToLocalConcept(
      CONTEXT,
      nodeType({ template }),
    );
    expect(concept.literal_content).not.toHaveProperty("template_content");
    expect(concept.literal_content).not.toHaveProperty("template");
  });

  it("keeps a slash-separated name whole in label and name", () => {
    const concept = discourseNodeSchemaToLocalConcept(
      CONTEXT,
      nodeType({ text: "Evidence/Figure" }),
    );
    expect(concept.name).toBe("Evidence/Figure");
    expect(concept.literal_content).toMatchObject({ label: "Evidence/Figure" });
  });
});
