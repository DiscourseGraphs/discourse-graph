import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { materializeObsidianNode } from "~/utils/materializeObsidianNode";

const mocks = vi.hoisted(() => ({
  deleteBlock: vi.fn(),
  findImportedNodeUidBySourceRid: vi.fn(),
  getShallowTreeByParentUid: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));

vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: mocks.getShallowTreeByParentUid,
}));

vi.mock("roamjs-components/writes/deleteBlock", () => ({
  default: mocks.deleteBlock,
}));

vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: mocks.findImportedNodeUidBySourceRid,
  writeImportedSourceIdentity: mocks.writeImportedSourceIdentity,
}));

const SOURCE_NODE_RID = "orn:obsidian.note:vault-a/node-1";
const SOURCE_MODIFIED_AT = "2026-06-14T15:00:00.000Z";
const NEW_PAGE_UID = "new-page-uid";
const EXISTING_PAGE_UID = "existing-page-uid";
const MARKDOWN = "# REM sleep correlates with recall\n\nUpdated evidence.";

const node: CrossAppNode = {
  localId: "node-1",
  nodeType: { localId: "evidence" },
  content: {
    direct: { value: "EVD - REM sleep and recall" },
    full: {
      contentType: contentTypes.obsidianMarkdown,
      value: MARKDOWN,
    },
  },
  createdAt: new Date("2026-06-14T10:30:00.000Z"),
  modifiedAt: new Date(SOURCE_MODIFIED_AT),
  author: { localId: "author" },
};

const pageFromMarkdown = vi.fn();
const blockFromMarkdown = vi.fn();
const deletePage = vi.fn();
const updatePage = vi.fn();

const setRoamAlphaApi = (): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        block: { fromMarkdown: blockFromMarkdown },
        page: {
          delete: deletePage,
          fromMarkdown: pageFromMarkdown,
          update: updatePage,
        },
      },
      util: { generateUID: () => NEW_PAGE_UID },
    },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteBlock.mockResolvedValue(undefined);
  mocks.getShallowTreeByParentUid.mockReturnValue([]);
  pageFromMarkdown.mockResolvedValue({ uid: NEW_PAGE_UID });
  blockFromMarkdown.mockResolvedValue({ uids: [] });
  deletePage.mockResolvedValue(undefined);
  updatePage.mockResolvedValue(undefined);
  setRoamAlphaApi();
});

describe("materializeObsidianNode", () => {
  it("creates a Roam page from Obsidian markdown and stores source identity", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);

    await expect(
      materializeObsidianNode({
        node,
        sourceModifiedAt: SOURCE_MODIFIED_AT,
        sourceNodeRid: SOURCE_NODE_RID,
      }),
    ).resolves.toEqual({
      success: true,
      action: "created",
      pageUid: NEW_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });

    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: {
        title: "EVD - REM sleep and recall",
        uid: NEW_PAGE_UID,
      },
      "markdown-string": MARKDOWN,
    });
    expect(mocks.writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: NEW_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("replaces the existing imported page instead of creating a duplicate", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mocks.getShallowTreeByParentUid.mockReturnValue([
      { uid: "old-child-1", text: "Old content" },
      { uid: "old-child-2", text: "More old content" },
    ]);

    await expect(
      materializeObsidianNode({
        node,
        sourceModifiedAt: SOURCE_MODIFIED_AT,
        sourceNodeRid: SOURCE_NODE_RID,
      }),
    ).resolves.toMatchObject({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
    });

    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(updatePage).toHaveBeenCalledWith({
      page: {
        title: "EVD - REM sleep and recall",
        uid: EXISTING_PAGE_UID,
      },
      "merge-pages": false,
    });
    expect(mocks.deleteBlock).toHaveBeenCalledTimes(2);
    expect(mocks.deleteBlock).toHaveBeenCalledWith("old-child-1");
    expect(mocks.deleteBlock).toHaveBeenCalledWith("old-child-2");
    expect(blockFromMarkdown).toHaveBeenCalledWith({
      location: { "parent-uid": EXISTING_PAGE_UID, order: "last" },
      "markdown-string": MARKDOWN,
    });
    expect(mocks.writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("returns the source identity and failed stage when replacement fails", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    blockFromMarkdown.mockRejectedValue(new Error("markdown parser failed"));

    await expect(
      materializeObsidianNode({
        node,
        sourceModifiedAt: SOURCE_MODIFIED_AT,
        sourceNodeRid: SOURCE_NODE_RID,
      }),
    ).resolves.toEqual({
      success: false,
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: `Failed to replace Roam content for '${SOURCE_NODE_RID}': markdown parser failed`,
        stage: "replace-page-content",
      },
    });
    expect(mocks.writeImportedSourceIdentity).not.toHaveBeenCalled();
    expect(mocks.deleteBlock).not.toHaveBeenCalled();
  });

  it("removes a new page if its source identity cannot be stored", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);
    mocks.writeImportedSourceIdentity.mockRejectedValue(
      new Error("props update failed"),
    );

    const result = await materializeObsidianNode({
      node,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });

    expect(result).toMatchObject({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        stage: "write-source-identity",
      },
    });
    expect(result).not.toHaveProperty("pageUid");
    expect(deletePage).toHaveBeenCalledWith({ page: { uid: NEW_PAGE_UID } });
  });

  it("rejects non-Obsidian payload identity before writing to Roam", async () => {
    const sourceNodeRid = "orn:roam:graph-a/node-1";

    await expect(
      materializeObsidianNode({
        node,
        sourceModifiedAt: SOURCE_MODIFIED_AT,
        sourceNodeRid,
      }),
    ).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid,
      error: {
        message: `Source node RID '${sourceNodeRid}' is not Obsidian-origin`,
        stage: "validate-input",
      },
    });
    expect(mocks.findImportedNodeUidBySourceRid).not.toHaveBeenCalled();
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });
});
