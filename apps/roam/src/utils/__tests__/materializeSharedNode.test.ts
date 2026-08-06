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
vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
  readImportedSourceIdentity: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));

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

const sharedNode: SharedNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  sourceLocalId: "node-1",
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
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      updatePage,
      util: { generateUID: vi.fn(() => GENERATED_PAGE_UID) },
      data: {
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
    });
    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: { title: roamSharedNode.title, uid: GENERATED_PAGE_UID },
      "markdown-string": "- REM sleep improves recall",
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
