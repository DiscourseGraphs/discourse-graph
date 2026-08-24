import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const { mockedGetPageUidByPageTitle, mockedGetDiscourseNodes } = vi.hoisted(
  () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockedGetPageUidByPageTitle: vi.fn((_title: string) => ""),
    mockedGetDiscourseNodes: vi.fn((): DiscourseNode[] => []),
  }),
);
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: mockedGetPageUidByPageTitle,
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

import {
  discourseNodeBlockToLocalConcept,
  discourseNodeSchemaToLocalConcept,
} from "~/utils/conceptConversion";

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

  it("keeps the label and template it already carried", () => {
    const concept = discourseNodeSchemaToLocalConcept(
      CONTEXT,
      nodeType({ template: [{ text: "Question:" }] }),
    );
    expect(concept.literal_content).toEqual({
      label: "Evidence",
      format: "[[EVD]] - {content} - {Source}",
      template: "* Question:\n",
      roles: ["sourceDocument"],
    });
  });
});

describe("discourseNodeBlockToLocalConcept core title", () => {
  it("writes the undecorated core title into literal_content", () => {
    const concept = discourseNodeBlockToLocalConcept(CONTEXT, {
      nodeUid: "node-1",
      schemaUid: "clm",
      title: "[[CLM]] - my claim",
      schema: nodeType({
        text: "Claim",
        type: "clm",
        format: "[[CLM]] - {content}",
      }),
    });
    expect(concept.literal_content).toEqual({ core_title: "my claim" });
    expect(concept.name).toBe("[[CLM]] - my claim");
    expect(concept.source_local_id).toBe("node-1");
  });

  it("keeps the whole title when the schema is unknown", () => {
    const concept = discourseNodeBlockToLocalConcept(CONTEXT, {
      nodeUid: "node-1",
      schemaUid: "clm",
      title: "[[CLM]] - my claim",
    });
    expect(concept.literal_content).toEqual({
      core_title: "[[CLM]] - my claim",
    });
  });
});

describe("discourseNodeBlockToLocalConcept source slot", () => {
  const convert = (title: string, schema: DiscourseNode = nodeType({})) =>
    discourseNodeBlockToLocalConcept(CONTEXT, {
      nodeUid: "node-1",
      schemaUid: schema.type,
      title,
      schema,
    });

  it("resolves the source page named in the title", () => {
    const concept = convert(
      "[[EVD]] - REM sleep aids recall - [[@sun2019direct]]",
    );
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "source-1",
    });
  });

  // Leniency on the target type: see sourceSlot.ts
  it("accepts a source that is a node of another type", () => {
    mockedGetDiscourseNodes.mockReturnValue([
      SOURCE_TYPE,
      nodeType({ text: "Claim", type: "clm", format: "[[CLM]] - {content}" }),
    ]);
    mockedGetPageUidByPageTitle.mockImplementation(() => "claim-1");
    const concept = convert(
      "[[EVD]] - REM sleep aids recall - [[CLM]] - a claim",
    );
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "claim-1",
    });
  });

  it("omits the slot when the source page is not a discourse node", () => {
    mockedGetPageUidByPageTitle.mockImplementation(() => "some-page");
    const concept = convert(
      "[[EVD]] - REM sleep aids recall - [[a plain page]]",
    );
    expect(concept.local_reference_content).toBeUndefined();
  });

  it("omits the slot when the source page does not exist", () => {
    const concept = convert(
      "[[EVD]] - REM sleep aids recall - [[@unknownref]]",
    );
    expect(concept.local_reference_content).toBeUndefined();
  });

  it("skips a source containing a slash, even when the page exists", () => {
    const concept = convert(
      "[[EVD]] - REM sleep aids recall - [[@sun2019direct/fig2]]",
    );
    expect(concept.local_reference_content).toBeUndefined();
    expect(mockedGetPageUidByPageTitle).not.toHaveBeenCalled();
  });

  it("omits the slot when the node type has no source placeholder", () => {
    const concept = convert(
      "[[CLM]] - REM sleep aids recall",
      nodeType({ text: "Claim", type: "clm", format: "[[CLM]] - {content}" }),
    );
    expect(concept.local_reference_content).toBeUndefined();
  });

  it("uses the page title, not the block text, of a block-backed node", () => {
    const concept = discourseNodeBlockToLocalConcept(CONTEXT, {
      nodeUid: "node-1",
      schemaUid: "_EVD-node",
      title: "[[EVD]] - REM sleep aids recall - [[@sun2019direct]]",
      schema: nodeType({}),
    });
    expect(concept.local_reference_content).toEqual({
      sourceDocument: "source-1",
    });
  });

  it("carries the type author as author_local_id", () => {
    stubRoamQuery();
    const concept = discourseNodeSchemaToLocalConcept(context, claimSchema);
    expect(concept.author_local_id).toBe("author-1");
  });
});
