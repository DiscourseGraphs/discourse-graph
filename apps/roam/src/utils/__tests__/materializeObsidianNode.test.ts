import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { materializeObsidianNode } from "~/utils/materializeObsidianNode";

const mocks = vi.hoisted(() => ({
  deleteBlock: vi.fn(),
  findImportedNodeUidBySourceRid: vi.fn(),
  getPageUidByPageTitle: vi.fn(),
  getShallowTreeByParentUid: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: mocks.getPageUidByPageTitle,
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
const TITLE = "EVD - REM sleep and recall";

const SOURCE_MARKDOWN = [
  "---",
  "nodeTypeId: evidence-type-id",
  "nodeInstanceId: node-1",
  "publishedToGroups:",
  "  - group-a",
  "---",
  "",
  "# REM sleep correlates with recall",
  "",
  "Updated evidence.",
].join("\n");

const MATERIALIZED_MARKDOWN =
  "# REM sleep correlates with recall\n\nUpdated evidence.";

const node: CrossAppNode = {
  localId: "node-1",
  nodeType: "evidence",
  content: {
    direct: { value: TITLE },
    full: {
      contentType: contentTypes.obsidianMarkdown,
      value: SOURCE_MARKDOWN,
    },
  },
  createdAt: new Date("2026-06-14T10:30:00.000Z"),
  modifiedAt: new Date(SOURCE_MODIFIED_AT),
  authorId: "author",
};

const input = {
  node,
  sourceApp: "Obsidian" as const,
  sourceModifiedAt: SOURCE_MODIFIED_AT,
  sourceNodeRid: SOURCE_NODE_RID,
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
  mocks.getPageUidByPageTitle.mockReturnValue("");
  mocks.getShallowTreeByParentUid.mockReturnValue([]);
  pageFromMarkdown.mockResolvedValue(undefined);
  blockFromMarkdown.mockResolvedValue(undefined);
  deletePage.mockResolvedValue(undefined);
  updatePage.mockResolvedValue(undefined);
  setRoamAlphaApi();
});

describe("materializeObsidianNode", () => {
  it("creates a Roam page from the markdown body and stores source identity", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);

    await expect(materializeObsidianNode(input)).resolves.toEqual({
      success: true,
      action: "created",
      pageUid: NEW_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });

    expect(pageFromMarkdown).toHaveBeenCalledWith({
      page: {
        title: TITLE,
        uid: NEW_PAGE_UID,
      },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
    expect(mocks.writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: NEW_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("stores the source modified time as canonical UTC", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);

    await expect(
      materializeObsidianNode({
        ...input,
        sourceModifiedAt: "2026-06-14T15:00:00+02:00",
      }),
    ).resolves.toMatchObject({
      success: true,
      sourceModifiedAt: "2026-06-14T13:00:00.000Z",
    });
    expect(mocks.writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: NEW_PAGE_UID,
      sourceModifiedAt: "2026-06-14T13:00:00.000Z",
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("replaces the existing imported page instead of creating a duplicate", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mocks.getShallowTreeByParentUid.mockReturnValue([
      { uid: "old-child-1", text: "Old content" },
      { uid: "old-child-2", text: "More old content" },
    ]);

    await expect(materializeObsidianNode(input)).resolves.toMatchObject({
      success: true,
      action: "updated",
      pageUid: EXISTING_PAGE_UID,
    });

    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(blockFromMarkdown).toHaveBeenCalledWith({
      location: { "parent-uid": EXISTING_PAGE_UID, order: "last" },
      "markdown-string": MATERIALIZED_MARKDOWN,
    });
    expect(mocks.deleteBlock).toHaveBeenCalledTimes(2);
    expect(mocks.deleteBlock).toHaveBeenCalledWith("old-child-1");
    expect(mocks.deleteBlock).toHaveBeenCalledWith("old-child-2");
    expect(updatePage).toHaveBeenCalledWith({
      page: {
        title: TITLE,
        uid: EXISTING_PAGE_UID,
      },
      "merge-pages": false,
    });
    expect(mocks.writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("leaves the existing page untouched when replacement fails", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    blockFromMarkdown.mockRejectedValue(new Error("markdown parser failed"));

    await expect(materializeObsidianNode(input)).resolves.toEqual({
      success: false,
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: `Failed to replace Roam content for '${SOURCE_NODE_RID}': markdown parser failed`,
        stage: "replace-page-content",
      },
    });
    expect(updatePage).not.toHaveBeenCalled();
    expect(mocks.deleteBlock).not.toHaveBeenCalled();
    expect(mocks.writeImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("removes a new page if its source identity cannot be stored", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);
    mocks.writeImportedSourceIdentity.mockRejectedValue(
      new Error("props update failed"),
    );

    const result = await materializeObsidianNode(input);

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

  it("reports the orphaned page uid when cleanup also fails", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);
    mocks.writeImportedSourceIdentity.mockRejectedValue(
      new Error("props update failed"),
    );
    deletePage.mockRejectedValue(new Error("delete refused"));

    await expect(materializeObsidianNode(input)).resolves.toMatchObject({
      success: false,
      pageUid: NEW_PAGE_UID,
      error: {
        stage: "write-source-identity",
      },
    });
  });

  it("refuses to clobber a Roam page that was not imported from this source", async () => {
    mocks.findImportedNodeUidBySourceRid.mockResolvedValue(null);
    mocks.getPageUidByPageTitle.mockReturnValue("local-page-uid");

    await expect(materializeObsidianNode(input)).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: `A Roam page titled '${TITLE}' already exists and was not imported from '${SOURCE_NODE_RID}'`,
        stage: "title-collision",
      },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
    expect(mocks.writeImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("rejects a non-Obsidian source app before writing to Roam", async () => {
    await expect(
      materializeObsidianNode({ ...input, sourceApp: "Roam" }),
    ).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: "Source app 'Roam' is not Obsidian",
        stage: "validate-input",
      },
    });
    expect(mocks.findImportedNodeUidBySourceRid).not.toHaveBeenCalled();
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("rejects a source identifier that is not a RID", async () => {
    await expect(
      materializeObsidianNode({ ...input, sourceNodeRid: "node-1" }),
    ).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: "node-1",
      error: {
        message: "Source node RID 'node-1' is not a RID",
        stage: "validate-input",
      },
    });
    expect(mocks.findImportedNodeUidBySourceRid).not.toHaveBeenCalled();
  });

  it("rejects a node without full content before writing to Roam", async () => {
    await expect(
      materializeObsidianNode({
        ...input,
        node: { ...node, content: { direct: node.content.direct } },
      }),
    ).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: "Source node has no full content to materialize",
        stage: "validate-input",
      },
    });
    expect(mocks.findImportedNodeUidBySourceRid).not.toHaveBeenCalled();
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("rejects a node whose markdown is only frontmatter", async () => {
    await expect(
      materializeObsidianNode({
        ...input,
        node: {
          ...node,
          content: {
            ...node.content,
            full: {
              contentType: contentTypes.obsidianMarkdown,
              value: "---\nnodeInstanceId: node-1\n---\n",
            },
          },
        },
      }),
    ).resolves.toEqual({
      success: false,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
      error: {
        message: "Source node has no markdown body outside its frontmatter",
        stage: "validate-input",
      },
    });
    expect(pageFromMarkdown).not.toHaveBeenCalled();
  });

  it("rejects a full content type Roam cannot materialize", async () => {
    await expect(
      materializeObsidianNode({
        ...input,
        node: {
          ...node,
          content: {
            ...node.content,
            full: {
              contentType: contentTypes.roamJson,
              value: "{}",
            },
          },
        },
      }),
    ).resolves.toMatchObject({
      success: false,
      error: {
        message: `Unsupported Obsidian full content type '${contentTypes.roamJson}'`,
        stage: "validate-input",
      },
    });
  });
});
