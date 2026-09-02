import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Json } from "@repo/database/dbTypes";
import defaultDiscourseNodes from "~/data/defaultDiscourseNodes";
import type { ImportedSourceIdentity } from "~/utils/importedSourceIdentity";

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("~/utils/pageToMarkdown", () => ({ toMarkdown: () => "" }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: vi.fn(() => defaultDiscourseNodes),
}));

const { mockedGetPageUidByPageTitle, mockedReadImportedSourceIdentity } =
  vi.hoisted(() => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockedGetPageUidByPageTitle: vi.fn((_title: string) => ""),
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

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import {
  fullContentNodeToCrossApp,
  nodeSchemaToCrossApp,
  nodeUidsWithTypeToCrossApp,
} from "~/utils/roamToCrossAppConverters";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";

const mockedGetDiscourseNodes = vi.mocked(getDiscourseNodes);

const claimSchema: DiscourseNode = {
  type: "schema-1",
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "CLM - {content}",
};

const USER_ROW = { ":db/id": 5, ":user/uid": "user-1" };

const convertRow = async (row: Record<string, Json>) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        async: {
          pull_many: vi
            .fn()
            .mockResolvedValueOnce([row])
            .mockResolvedValueOnce([USER_ROW]),
        },
      },
    },
  };
  const [node] = await nodeUidsWithTypeToCrossApp([
    { uid: "node-1", type: "schema-1" },
  ]);
  return node;
};

const baseRow = {
  ":block/uid": "node-1",
  ":node/title": "CLM - claim",
  ":create/user": { ":db/id": 5 },
  ":create/time": 1000,
};

describe("nodeUidsWithTypeToCrossApp timestamps", () => {
  it("uses the page edit time when present", async () => {
    const node = await convertRow({
      ...baseRow,
      ":edit/time": 2000,
      ":page/edit-time": 3000,
    });
    expect(node.createdAt).toEqual(new Date(1000));
    expect(node.modifiedAt).toEqual(new Date(3000));
  });

  it("falls back to the node edit time when page edit time is absent", async () => {
    const node = await convertRow({ ...baseRow, ":edit/time": 2000 });
    expect(node.modifiedAt).toEqual(new Date(2000));
  });

  it("falls back to the create time when no edit time exists", async () => {
    const node = await convertRow(baseRow);
    expect(node.modifiedAt).toEqual(new Date(1000));
  });
});

describe("nodeUidsWithTypeToCrossApp coreTitle", () => {
  it("extracts the content from a title matching the node type's format", async () => {
    mockedGetDiscourseNodes.mockReturnValue([claimSchema]);
    const node = await convertRow(baseRow);
    expect(node.coreTitle).toBe("claim");
  });

  it("keeps the whole title when the node type is unknown", async () => {
    mockedGetDiscourseNodes.mockReturnValue([]);
    const node = await convertRow(baseRow);
    expect(node.coreTitle).toBe("CLM - claim");
  });
});

describe("fullContentNodeToCrossApp coreTitle", () => {
  const baseNode = {
    author_local_id: "user-1",
    source_local_id: "node-1",
    created: 1000,
    last_modified: 2000,
    node_type_id: "schema-1",
    format: "CLM - {content}",
    text: "CLM - claim",
  };

  it("extracts the content from the title", () => {
    const node = fullContentNodeToCrossApp(baseNode);
    expect(node.coreTitle).toBe("claim");
  });

  it("extracts from the page title when node_title is present", () => {
    const node = fullContentNodeToCrossApp({
      ...baseNode,
      text: "some block text",
      node_title: "CLM - claim",
    });
    expect(node.coreTitle).toBe("claim");
  });

  it("keeps the whole title when it does not match the format", () => {
    const node = fullContentNodeToCrossApp({
      ...baseNode,
      text: "unrelated title",
    });
    expect(node.coreTitle).toBe("unrelated title");
  });
});

const nodeSchema = (overrides: Partial<DiscourseNode>): DiscourseNode => ({
  text: "Evidence",
  type: "_EVD-node",
  shortcut: "e",
  format: "[[EVD]] - {content} - {Source}",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  ...overrides,
});

// For the timestamp tests: what Roam holds about one node type page.
const convertSchemaPull = (pullResult: Record<string, unknown> | null) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      pull: () => pullResult,
    },
  };
  return nodeSchemaToCrossApp(nodeSchema({}));
};

const schemaPull = {
  ":create/time": 1000,
  ":create/user": { ":user/uid": "user-1" },
};

const convertSchema = (node: DiscourseNode) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      pull: () => ({
        ":create/time": 1000,
        ":edit/time": 2000,
        ":create/user": { ":user/uid": "user-1" },
      }),
    },
  };
  return nodeSchemaToCrossApp(node);
};

describe("nodeSchemaToCrossApp timestamps", () => {
  it("takes the page edit time, as written when a block below it changes", () => {
    const schema = convertSchemaPull({
      ...schemaPull,
      ":edit/time": 2000,
      ":page/edit-time": 4000,
    });
    expect(schema?.modifiedAt).toEqual(new Date(4000));
  });

  it("falls back to the create time when neither exists", () => {
    const schema = convertSchemaPull(schemaPull);
    expect(schema?.modifiedAt).toEqual(new Date(1000));
  });

  it("is null without an author, rather than a concept that cannot be inserted", () => {
    expect(convertSchemaPull({ ":create/time": 1000 })).toBeNull();
  });
});

describe("nodeSchemaToCrossApp format", () => {
  it("carries the node type format", () => {
    const schema = convertSchemaPull(schemaPull);
    expect(schema?.format).toBe("[[EVD]] - {content} - {Source}");
  });
});

describe("nodeSchemaToCrossApp source slot", () => {
  it("adds a sourceDocument slot definition pointing at the Source node type", () => {
    mockedGetDiscourseNodes.mockReturnValue([
      nodeSchema({ text: "Source", type: "src-node", format: "@{content}" }),
    ]);
    expect(convertSchema(nodeSchema({}))?.slotDefinitions).toEqual({
      sourceDocument: "src-node",
    });
  });

  it("falls back to the default source type when no Source node exists", () => {
    mockedGetDiscourseNodes.mockReturnValue([]);
    expect(convertSchema(nodeSchema({}))?.slotDefinitions).toEqual({
      sourceDocument: "_SRC-node",
    });
  });
});

describe("nodeUidsWithTypeToCrossApp source slot", () => {
  const EVIDENCE_SCHEMA = nodeSchema({
    type: "schema-1",
  });
  const SOURCE_SCHEMA = nodeSchema({
    text: "Source",
    type: "src-node",
    format: "@{content}",
  });
  // Roam-like lookup: only existing pages resolve to a uid.
  const PAGE_UIDS: Record<string, string> = {
    "@sun2019direct": "source-1",
    "@sun2019direct/fig2": "source-2",
  };

  beforeEach(() => {
    mockedGetPageUidByPageTitle.mockReset();
    mockedGetPageUidByPageTitle.mockImplementation(
      (title: string) => PAGE_UIDS[title] ?? "",
    );
    mockedReadImportedSourceIdentity.mockReset();
  });

  it("resolves the source page from the title into a sourceDocument slot", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[@sun2019direct]]",
    });
    expect(node.slots).toEqual({ sourceDocument: "source-1" });
  });

  it("writes the origin RID when the source page was imported from another app", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: "2026-06-14T15:00:00.000Z",
      sourceNodeRid: "orn:obsidian.note:vault-a/node-1",
    });
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[@sun2019direct]]",
    });
    expect(node.slots).toEqual({
      sourceDocument: "orn:obsidian.note:vault-a/node-1",
    });
    expect(mockedReadImportedSourceIdentity).toHaveBeenCalledWith("source-1");
  });

  it("keeps the page uid when the imported identity is not a RID", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: "2026-06-14T15:00:00.000Z",
      sourceNodeRid: "not a rid",
    });
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[@sun2019direct]]",
    });
    expect(node.slots).toEqual({ sourceDocument: "source-1" });
  });

  // Leniency on the target type: see sourceSlot.ts
  it("accepts a source that is a node of another type", async () => {
    mockedGetDiscourseNodes.mockReturnValue([
      EVIDENCE_SCHEMA,
      SOURCE_SCHEMA,
      nodeSchema({ text: "Claim", type: "clm", format: "[[CLM]] - {content}" }),
    ]);
    mockedGetPageUidByPageTitle.mockImplementation(() => "claim-1");
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[CLM]] - a claim",
    });
    expect(node.slots).toEqual({ sourceDocument: "claim-1" });
  });

  it("omits slots when the source page is not a discourse node", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    mockedGetPageUidByPageTitle.mockImplementation(() => "some-page");
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[a plain page]]",
    });
    expect(node.slots).toBeUndefined();
  });

  it("omits slots when the source page does not exist", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[EVD]] - REM sleep aids recall - [[@unknownref]]",
    });
    expect(node.slots).toBeUndefined();
  });

  it("skips sources containing a slash, even when the page exists", async () => {
    mockedGetDiscourseNodes.mockReturnValue([EVIDENCE_SCHEMA, SOURCE_SCHEMA]);
    const node = await convertRow({
      ...baseRow,
      ":node/title":
        "[[EVD]] - REM sleep aids recall - [[@sun2019direct/fig2]]",
    });
    expect(node.slots).toBeUndefined();
    expect(mockedGetPageUidByPageTitle).not.toHaveBeenCalled();
  });

  it("omits slots when the schema format has no source placeholder", async () => {
    mockedGetDiscourseNodes.mockReturnValue([
      nodeSchema({ type: "schema-1", format: "[[CLM]] - {content}" }),
      SOURCE_SCHEMA,
    ]);
    const node = await convertRow({
      ...baseRow,
      ":node/title": "[[CLM]] - REM sleep aids recall",
    });
    expect(node.slots).toBeUndefined();
  });
});
