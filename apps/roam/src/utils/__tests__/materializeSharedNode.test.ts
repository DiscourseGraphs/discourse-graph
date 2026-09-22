import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import {
  findImportedNodeUidBySourceRid,
  readImportedSourceIdentity,
  writeImportedSourceIdentity,
} from "~/utils/importedSourceIdentity";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import {
  importNodeAssets,
  type AssetImportReport,
} from "~/utils/importNodeAssets";
import { materializeSharedNode } from "~/utils/materializeSharedNode";

vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/writes/deleteBlock", () => ({ default: vi.fn() }));
vi.mock("~/utils/importNodeAssets", () => ({
  importNodeAssets: vi.fn(),
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
  readImportedSourceIdentity: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));

// Runs before the imports above: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

const mockedImportNodeAssets = vi.mocked(importNodeAssets);
const mockedGetPageTitleByPageUid = vi.mocked(getPageTitleByPageUid);
const mockedGetPageUidByPageTitle = vi.mocked(getPageUidByPageTitle);
const mockedGetShallowTreeByParentUid = vi.mocked(getShallowTreeByParentUid);
const mockedDeleteBlock = vi.mocked(deleteBlock);
const mockedFindImportedNodeUidBySourceRid = vi.mocked(
  findImportedNodeUidBySourceRid,
);
const mockedReadImportedSourceIdentity = vi.mocked(readImportedSourceIdentity);
const mockedWriteImportedSourceIdentity = vi.mocked(
  writeImportedSourceIdentity,
);

const EXISTING_PAGE_UID = "existing-page-uid";
const GENERATED_PAGE_UID = "generated-page-uid";

const pageFromMarkdown = vi.fn();
const blockFromMarkdown = vi.fn();
const pageCreate = vi.fn();
const pageDelete = vi.fn();
const updatePage = vi.fn();
const roamQuery = vi.fn();

const CORE_TITLE = "REM sleep and recall";
const DECORATED_TITLE = "[[EVD]] - REM sleep and recall";
const NODE_TYPE = { format: "[[EVD]] - {content}" };

const LOCAL_GRAPH = "local-graph";
const SOURCED_NODE_TYPE = { format: "[[EVD]] - {content} - {Source}" };
const SOURCE_PAGE_UID = "source-page-uid";
const SOURCE_TITLE = "@Smith 2020";
const SOURCED_TITLE = `[[EVD]] - REM sleep and recall - [[${SOURCE_TITLE}]]`;
const PLACEHOLDER_TITLE = "[[EVD]] - REM sleep and recall - [[@placeholder]]";
const IMPORTED_SOURCE_RID = "orn:obsidian.note:vault-b/node-6";

const sharedNode: SharedNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  sourceLocalId: "node-1",
  schemaId: 200,
  spaceId: 20,
  spaceName: "Research vault",
  spaceUri: "obsidian:vault-a",
  platform: "Obsidian",
  title: "EVD - REM sleep and recall",
  created: "2026-06-14T12:30:00.000Z",
  lastModified: "2026-06-14T15:00:00.000Z",
  authorId: 7,
  directMetadata: null,
};

const decoratedSharedNode: SharedNode = {
  ...sharedNode,
  coreTitle: CORE_TITLE,
};

const roamSharedNode: SharedNode = {
  ...sharedNode,
  rid: "https://roamresearch.com/#/app/source-graph/node-2",
  sourceLocalId: "node-2",
  spaceId: 21,
  spaceName: "Source graph",
  spaceUri: "https://roamresearch.com/#/app/source-graph",
  platform: "Roam",
};

const FULL_MARKDOWN = [
  "---",
  "nodeTypeId: evidence",
  "---",
  "",
  "# Findings",
  "REM sleep improves recall",
].join("\n");

const MATERIALIZED_MARKDOWN = "# Findings\nREM sleep improves recall";

const ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/f.appspot.com/o/imgs%2Fapp%2Fgraph%2Fx.pdf?alt=media&token=abc";

const NO_ASSETS = { mirrored: 0, reused: 0, skipped: [], failed: [] };

const clientWithFullContent = ({
  text,
  contentType = "text/obsidian+markdown",
  error,
}: {
  text?: string | null;
  contentType?: string | null;
  error?: { message: string };
}): {
  client: DGSupabaseClient;
  eq: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} => {
  const maybeSingle = vi.fn().mockResolvedValue(
    error
      ? { data: null, error }
      : {
          data: text === undefined ? null : { text, content_type: contentType },
          error: null,
        },
  );
  const eq = vi.fn();
  const chain = { eq, maybeSingle };
  eq.mockReturnValue(chain);
  const from = vi
    .fn()
    .mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
  return { client: { from } as unknown as DGSupabaseClient, eq, from };
};

beforeEach(() => {
  vi.clearAllMocks();
  // The client stub's select chain isn't thenable, so the real asset stage can't run here.
  mockedImportNodeAssets.mockImplementation(({ markdown }) =>
    Promise.resolve({ markdown, report: NO_ASSETS }),
  );
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      updatePage,
      graph: { name: LOCAL_GRAPH },
      util: { generateUID: vi.fn(() => GENERATED_PAGE_UID) },
      data: {
        async: { fast: { q: roamQuery } },
        block: { fromMarkdown: blockFromMarkdown },
        page: {
          fromMarkdown: pageFromMarkdown,
          create: pageCreate,
          delete: pageDelete,
        },
      },
    },
  };
  mockedGetShallowTreeByParentUid.mockReturnValue([]);
  mockedGetPageUidByPageTitle.mockReturnValue("");
  mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
  mockedReadImportedSourceIdentity.mockReturnValue(undefined);
});

describe("materializeSharedNode", () => {
  it("creates a Roam page from the markdown body and stores source identity", async () => {
    const { client, eq } = clientWithFullContent({ text: FULL_MARKDOWN });

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({
      success: true,
      action: "created",
      pageUid: GENERATED_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(eq).toHaveBeenCalledWith("original", true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
    expect(mockedWriteImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: GENERATED_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });
  });

  it("stores the source modified time as canonical UTC", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: { ...sharedNode, lastModified: "2026-06-14T17:00:00+02:00" },
    });

    expect(result.sourceModifiedAt).toBe("2026-06-14T15:00:00.000Z");
    expect(mockedWriteImportedSourceIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ sourceModifiedAt: "2026-06-14T15:00:00.000Z" }),
    );
  });

  it("preserves the indentation of a leading indented code block", async () => {
    const { client } = clientWithFullContent({
      text: ["---", "nodeTypeId: evidence", "---", "", "    const a = 1;"].join(
        "\n",
      ),
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": "    const a = 1;",
    });
  });

  it("creates a title-only page when the body is only whitespace", async () => {
    const { client } = clientWithFullContent({
      text: ["---", "nodeTypeId: evidence", "---", "", "  ", ""].join("\n"),
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.success).toBe(true);
    expect(pageCreate).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("creates a title-only page when the node has no full content", async () => {
    const { client } = clientWithFullContent({});

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.success).toBe(true);
    expect(pageCreate).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("replaces the existing imported page instead of creating a duplicate", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedGetShallowTreeByParentUid.mockReturnValue([
      { uid: "old-block", text: "stale" },
    ]);

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(updatePage).not.toHaveBeenCalled();
    expect(blockFromMarkdown).toHaveBeenCalledWith({
      location: { "parent-uid": EXISTING_PAGE_UID, order: "last" },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
    expect(mockedDeleteBlock).toHaveBeenCalledWith("old-block");
    expect(blockFromMarkdown.mock.invocationCallOrder[0]).toBeLessThan(
      mockedDeleteBlock.mock.invocationCallOrder[0],
    );
  });

  it("skips an imported page whose source has not changed", async () => {
    const { client, from } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({
      success: true,
      action: "skipped",
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });
    expect(from).not.toHaveBeenCalled();
    expect(blockFromMarkdown).not.toHaveBeenCalled();
    expect(mockedDeleteBlock).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("force-updates an imported page whose source has not changed", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    await expect(
      materializeSharedNode({ client, sharedNode, force: true }),
    ).resolves.toEqual({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(blockFromMarkdown).toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });
  });

  it("updates an imported page whose source changed since the import", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: "2026-06-14T14:00:00.000Z",
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({ success: true, action: "updated" });
    expect(blockFromMarkdown).toHaveBeenCalled();
  });

  it("updates an imported page whose stored modified time is invalid", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: "not-a-date",
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({ success: true, action: "updated" });
  });

  it("renames the imported page when the source title changed", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue("EVD - old title");

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.success).toBe(true);
    expect(updatePage).toHaveBeenCalledWith({
      page: { uid: EXISTING_PAGE_UID, title: sharedNode.title },
    });
  });

  it("decorates the page title with the local node type format", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: NODE_TYPE,
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: DECORATED_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("keeps the incoming title when the source published no core title", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode,
      nodeType: NODE_TYPE,
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("keeps the incoming title when the local node type has no format", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: { format: "" },
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: sharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("uses a placeholder reference when the format requires a Source but none was published", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({
      success: true,
      warning: "No source was published with this node.",
    });
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: PLACEHOLDER_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
    expect(PLACEHOLDER_TITLE).toMatch(
      getDiscourseNodeFormatExpression(SOURCED_NODE_TYPE.format),
    );
    expect(roamQuery).not.toHaveBeenCalled();
  });

  it("does not warn about a source when the publisher sent no core title", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode,
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toEqual({
      success: true,
      action: "created",
      pageUid: GENERATED_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
  });

  it("names a source page this graph owns", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    roamQuery.mockResolvedValue([[1]]);
    mockedGetPageTitleByPageUid.mockImplementation((uid) =>
      uid === SOURCE_PAGE_UID ? SOURCE_TITLE : "",
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: {
          sourceDocument: `https://roamresearch.com/#/app/${LOCAL_GRAPH}/${SOURCE_PAGE_UID}`,
        },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toEqual({
      success: true,
      action: "created",
      pageUid: GENERATED_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(roamQuery).toHaveBeenCalledWith(
      "[:find (?e) :in $ ?uid :where [?e :block/uid ?uid]]",
      SOURCE_PAGE_UID,
    );
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledTimes(1);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: SOURCED_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("names a source page imported from the publisher's own space", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockImplementation((rid) =>
      Promise.resolve(
        rid === "orn:obsidian.note:vault-a/node-9" ? SOURCE_PAGE_UID : null,
      ),
    );
    mockedGetPageTitleByPageUid.mockImplementation((uid) =>
      uid === SOURCE_PAGE_UID ? SOURCE_TITLE : "",
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: "node-9" },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({ success: true, action: "created" });
    expect(result).not.toHaveProperty("warning");
    expect(roamQuery).not.toHaveBeenCalled();
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: SOURCED_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("names a source page imported from a third space", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockImplementation((rid) =>
      Promise.resolve(rid === IMPORTED_SOURCE_RID ? SOURCE_PAGE_UID : null),
    );
    mockedGetPageTitleByPageUid.mockImplementation((uid) =>
      uid === SOURCE_PAGE_UID ? SOURCE_TITLE : "",
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({ success: true, action: "created" });
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: SOURCED_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("uses a placeholder reference when the Source is not in this graph", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({
      success: true,
      action: "created",
      warning: `Its source (${IMPORTED_SOURCE_RID}) is not in this graph. Import the source, then refresh this page.`,
    });
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      IMPORTED_SOURCE_RID,
    );
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: PLACEHOLDER_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
  });

  it("does not rename an unchanged placeholder title on explicit refresh", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockImplementation((rid) =>
      Promise.resolve(rid === sharedNode.rid ? EXISTING_PAGE_UID : null),
    );
    mockedGetPageTitleByPageUid.mockReturnValue(PLACEHOLDER_TITLE);
    mockedGetPageUidByPageTitle.mockImplementation((title) =>
      title === PLACEHOLDER_TITLE ? EXISTING_PAGE_UID : "",
    );
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
      force: true,
    });

    expect(result).toMatchObject({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
    });
    expect(updatePage).not.toHaveBeenCalled();
    expect(pageCreate).not.toHaveBeenCalled();
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("does not look up the source of an import that is up to date", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({ success: true, action: "skipped" });
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledTimes(1);
    expect(mockedGetPageTitleByPageUid).not.toHaveBeenCalled();
  });

  it("keeps distinct incoming titles when same-core imports have unresolved Sources", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    const pages = new Map<string, string>();
    mockedGetPageUidByPageTitle.mockImplementation(
      (title) => pages.get(title) ?? "",
    );
    const storePage = ({
      page,
    }: {
      page: { title: string; uid: string };
    }): void => {
      pages.set(page.title, page.uid);
    };
    pageFromMarkdown
      .mockImplementationOnce(storePage)
      .mockImplementationOnce(storePage);
    vi.mocked(window.roamAlphaAPI.util.generateUID)
      .mockReturnValueOnce("first-page")
      .mockReturnValueOnce("second-page");
    const first = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        title: "Published evidence from Source A",
        slots: { sourceDocument: "source-a" },
      },
      nodeType: SOURCED_NODE_TYPE,
    });
    const second = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        rid: "orn:obsidian.note:vault-a/node-2",
        title: "Published evidence from Source B",
        slots: { sourceDocument: "source-b" },
      },
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(first).toMatchObject({ success: true, pageUid: "first-page" });
    expect(second).toMatchObject({
      success: true,
      action: "created",
      pageUid: "second-page",
    });
    if (!second.success) throw new Error(second.error.message);
    expect(second.warning).toContain("placeholder title");
    expect(second.warning).toContain("source-b");
    expect(second.warning).toContain("kept the incoming title");
    expect(pages).toEqual(
      new Map([
        [PLACEHOLDER_TITLE, "first-page"],
        ["Published evidence from Source B", "second-page"],
      ]),
    );
    expect(mockedWriteImportedSourceIdentity).toHaveBeenLastCalledWith({
      pageUid: "second-page",
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: "orn:obsidian.note:vault-a/node-2",
    });
  });

  it("keeps the incoming title on refresh when another page has the placeholder title", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedGetPageUidByPageTitle.mockImplementation((title) =>
      title === PLACEHOLDER_TITLE ? "another-import" : EXISTING_PAGE_UID,
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: SOURCED_NODE_TYPE,
      force: true,
    });

    expect(result).toMatchObject({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
    });
    if (!result.success) throw new Error(result.error.message);
    expect(result.warning).toContain("kept the incoming title");
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("still fails when the incoming fallback title also belongs to another page", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedGetPageUidByPageTitle.mockReturnValue("unrelated-page");

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: SOURCED_NODE_TYPE,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        stage: "title-collision",
      },
    });
    if (result.success) throw new Error("Expected a title collision");
    expect(result.error.message).toContain(sharedNode.title);
    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("leaves a title that already names its source untouched when refreshing", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockImplementation((rid) =>
      Promise.resolve(
        rid === IMPORTED_SOURCE_RID
          ? SOURCE_PAGE_UID
          : rid === sharedNode.rid
            ? EXISTING_PAGE_UID
            : null,
      ),
    );
    mockedGetPageTitleByPageUid.mockImplementation((uid) =>
      uid === SOURCE_PAGE_UID ? SOURCE_TITLE : SOURCED_TITLE,
    );
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
      force: true,
    });

    expect(result).toEqual({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("renames an imported page once its source arrives and it is refreshed", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockImplementation((rid) =>
      Promise.resolve(
        rid === IMPORTED_SOURCE_RID
          ? SOURCE_PAGE_UID
          : rid === sharedNode.rid
            ? EXISTING_PAGE_UID
            : null,
      ),
    );
    mockedGetPageTitleByPageUid.mockImplementation((uid) =>
      uid === SOURCE_PAGE_UID ? SOURCE_TITLE : PLACEHOLDER_TITLE,
    );
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: {
        ...decoratedSharedNode,
        slots: { sourceDocument: IMPORTED_SOURCE_RID },
      },
      nodeType: SOURCED_NODE_TYPE,
      force: true,
    });

    expect(result).toMatchObject({ success: true, action: "updated" });
    expect(updatePage).toHaveBeenCalledWith({
      page: { uid: EXISTING_PAGE_UID, title: SOURCED_TITLE },
    });
  });

  it("strips the Roam heading by the source title while decorating the page title", async () => {
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n\n- REM sleep improves recall`,
      contentType: "text/roam+markdown",
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: { ...roamSharedNode, coreTitle: CORE_TITLE },
      nodeType: NODE_TYPE,
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: DECORATED_TITLE, uid: GENERATED_PAGE_UID },
      "markdown-string": "- REM sleep improves recall",
    });
  });

  it("renames the imported page when decoration changes its title", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: NODE_TYPE,
    });

    expect(result.success).toBe(true);
    expect(updatePage).toHaveBeenCalledWith({
      page: { uid: EXISTING_PAGE_UID, title: DECORATED_TITLE },
    });
  });

  it("leaves an already decorated title untouched when refreshing", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(DECORATED_TITLE);
    mockedReadImportedSourceIdentity.mockReturnValue({
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: NODE_TYPE,
      force: true,
    });

    expect(result).toMatchObject({ success: true, action: "updated" });
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("writes the markdown the asset stage rewrote, and carries its report", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    const REWRITTEN = "![](https://firebasestorage.googleapis.com/v0/b/f/o/x)";
    const report: AssetImportReport = {
      mirrored: 1,
      reused: 0,
      skipped: [],
      failed: [{ sourceLocator: "attachments/big.png", message: "too big" }],
    };
    mockedImportNodeAssets.mockResolvedValue({ markdown: REWRITTEN, report });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(pageFromMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ "markdown-string": REWRITTEN }),
    );
    expect(result).toMatchObject({ success: true, assets: report });
  });

  it("reports an asset stage that rejects as its own stage", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedImportNodeAssets.mockRejectedValue(new Error("rewrite blew up"));

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "copy-assets" },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("refuses to clobber a page that was not imported from this source", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedGetPageUidByPageTitle.mockReturnValue("unrelated-page-uid");

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      sourceNodeRid: sharedNode.rid,
      error: { stage: "title-collision" },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
    expect(mockedImportNodeAssets).not.toHaveBeenCalled();
  });

  it("fails the rename before touching content when the new title collides", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue("EVD - old title");
    mockedGetPageUidByPageTitle.mockReturnValue("unrelated-page-uid");

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      pageUid: EXISTING_PAGE_UID,
      error: { stage: "title-collision" },
    });
    expect(blockFromMarkdown).not.toHaveBeenCalled();
    expect(mockedDeleteBlock).not.toHaveBeenCalled();
    expect(updatePage).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
    expect(mockedImportNodeAssets).not.toHaveBeenCalled();
  });

  it("checks the decorated title, so a decorated collision uploads nothing", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedGetPageUidByPageTitle.mockImplementation((title: string) =>
      title === DECORATED_TITLE ? "unrelated-page-uid" : "",
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: NODE_TYPE,
    });

    expect(result).toMatchObject({ error: { stage: "title-collision" } });
    expect(mockedImportNodeAssets).not.toHaveBeenCalled();
  });

  it("does not reject on the raw title when the decorated one is free", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedGetPageUidByPageTitle.mockImplementation((title: string) =>
      title === decoratedSharedNode.title ? "unrelated-page-uid" : "",
    );

    const result = await materializeSharedNode({
      client,
      sharedNode: decoratedSharedNode,
      nodeType: NODE_TYPE,
    });

    expect(result).toMatchObject({ success: true });
    expect(mockedImportNodeAssets).toHaveBeenCalled();
  });

  it("imports a Roam-origin node and strips the duplicated title heading", async () => {
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n\n- REM sleep improves recall\n`,
      contentType: "text/roam+markdown",
    });

    await expect(
      materializeSharedNode({ client, sharedNode: roamSharedNode }),
    ).resolves.toEqual({
      success: true,
      action: "created",
      pageUid: GENERATED_PAGE_UID,
      sourceModifiedAt: roamSharedNode.lastModified,
      sourceNodeRid: roamSharedNode.rid,
      assets: NO_ASSETS,
    });
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: roamSharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": "- REM sleep improves recall",
    });
  });

  // Without the brackets Roam's parser destroys the embed. See `protectMediaEmbeds`.
  it("brackets a media embed's URL before handing the markdown to Roam", async () => {
    const embed = `{{[[pdf]]: ${ASSET_URL}}}`;
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n\n${embed}\n`,
      contentType: "text/roam+markdown",
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: roamSharedNode,
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: roamSharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": `{{[[pdf]]: <${ASSET_URL}>}}`,
    });
  });

  it("brackets a media embed's URL when replacing an imported page too", async () => {
    const embed = `{{[[audio]]: ${ASSET_URL}}}`;
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n\n${embed}\n`,
      contentType: "text/roam+markdown",
    });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(roamSharedNode.title);

    const result = await materializeSharedNode({
      client,
      sharedNode: roamSharedNode,
    });

    expect(result.success).toBe(true);
    expect(blockFromMarkdown).toHaveBeenCalledWith({
      location: { "parent-uid": EXISTING_PAGE_UID, order: "last" },
      "markdown-string": `{{[[audio]]: <${ASSET_URL}>}}`,
    });
  });

  it("keeps a first line that does not match the shared title exactly", async () => {
    const { client } = clientWithFullContent({
      text: "# Some other heading\n\n- body",
      contentType: "text/roam+markdown",
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: roamSharedNode,
    });

    expect(result.success).toBe(true);
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: roamSharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": "# Some other heading\n\n- body",
    });
  });

  it("creates a title-only page when Roam full content is only the heading", async () => {
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n`,
      contentType: "text/roam+markdown",
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: roamSharedNode,
    });

    expect(result.success).toBe(true);
    expect(pageCreate).toHaveBeenCalledWith({
      page: { title: roamSharedNode.title, uid: GENERATED_PAGE_UID },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("rejects Obsidian markdown on a Roam-origin node", async () => {
    const { client } = clientWithFullContent({
      text: `# ${roamSharedNode.title}\n\n- body`,
      contentType: "text/obsidian+markdown",
    });

    const result = await materializeSharedNode({
      client,
      sharedNode: roamSharedNode,
    });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "fetch-content" },
    });
    expect(result.success === false && result.error.message).toContain(
      "text/roam+markdown",
    );
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("rejects a source identifier that is not a RID", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: { ...sharedNode, rid: "not-a-rid" },
    });

    expect(result).toMatchObject({
      success: false,
      sourceNodeRid: "not-a-rid",
      error: { stage: "validate-input" },
    });
  });

  it("rejects an invalid source modified time", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: { ...sharedNode, lastModified: "not-a-date" },
    });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "validate-input" },
    });
  });

  it("rejects a full content type Roam cannot materialize", async () => {
    const { client } = clientWithFullContent({
      text: `# ${sharedNode.title}\n\nbody`,
      contentType: "text/markdown",
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "fetch-content" },
    });
    expect(result.success === false && result.error.message).toContain(
      "text/markdown",
    );
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("fails with the fetch error and keeps identity in the result", async () => {
    const { client } = clientWithFullContent({
      error: { message: "permission denied" },
    });

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      sourceNodeRid: sharedNode.rid,
      error: { stage: "fetch-content" },
    });
    expect(result.success === false && result.error.message).toContain(
      "permission denied",
    );
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("removes a new page when its source identity cannot be stored", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedWriteImportedSourceIdentity.mockRejectedValue(
      new Error("props write failed"),
    );

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "write-source-identity" },
    });
    expect(pageDelete).toHaveBeenCalledWith({
      page: { uid: GENERATED_PAGE_UID },
    });
    expect(result.success === false && result.pageUid).toBeUndefined();
  });

  it("reports the orphaned page uid when cleanup also fails", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedWriteImportedSourceIdentity.mockRejectedValue(
      new Error("props write failed"),
    );
    pageDelete.mockRejectedValue(new Error("delete failed"));

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      pageUid: GENERATED_PAGE_UID,
      error: { stage: "write-source-identity" },
    });
  });

  it("keeps the updated page when refreshing identity fails on re-import", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedWriteImportedSourceIdentity.mockRejectedValue(
      new Error("props write failed"),
    );

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      pageUid: EXISTING_PAGE_UID,
      error: { stage: "write-source-identity" },
    });
    expect(pageDelete).not.toHaveBeenCalled();
  });

  it("reports a failed lookup of the existing import", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockRejectedValue(
      new Error("datalog query failed"),
    );

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result).toMatchObject({
      success: false,
      error: { stage: "find-imported-node" },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });
});
