import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  getSharedNodeByRid,
  type SharedNode,
} from "@repo/database/lib/sharedNodes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { readImportedSourceIdentity } from "~/utils/importedSourceIdentity";
import internalError from "~/utils/internalError";
import { materializeSharedNode } from "~/utils/materializeSharedNode";
import { refreshImportedNode } from "~/utils/refreshImportedNode";
import { resolveSharedNodeTypes } from "~/utils/resolveSharedNodeTypes";
import { getLoggedInClient } from "~/utils/supabaseContext";

vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: vi.fn(),
}));
vi.mock("@repo/database/lib/sharedNodes", () => ({
  getSharedNodeByRid: vi.fn(),
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
  readImportedSourceIdentity: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/materializeSharedNode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/utils/materializeSharedNode")>()),
  materializeSharedNode: vi.fn(),
}));
vi.mock("~/utils/resolveSharedNodeTypes", () => ({
  resolveSharedNodeTypes: vi.fn(),
}));
vi.mock("~/utils/supabaseContext", () => ({
  getLoggedInClient: vi.fn(),
}));

const mockedGetPageTitleByPageUid = vi.mocked(getPageTitleByPageUid);
const mockedGetSharedNodeByRid = vi.mocked(getSharedNodeByRid);
const mockedReadImportedSourceIdentity = vi.mocked(readImportedSourceIdentity);
const mockedInternalError = vi.mocked(internalError);
const mockedMaterializeSharedNode = vi.mocked(materializeSharedNode);
const mockedGetLoggedInClient = vi.mocked(getLoggedInClient);
const mockedResolveSharedNodeTypes = vi.mocked(resolveSharedNodeTypes);

const NODE_TYPE: DiscourseNode = {
  text: "Evidence",
  type: "evd-type-uid",
  shortcut: "E",
  format: "[[EVD]] - {content}",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
};

const PAGE_UID = "imported-page-uid";
const LOCAL_TITLE = "EVD - old local title";
const OTHER_PAGE_TITLE = "EVD - duplicate page";

const client = {} as DGSupabaseClient;

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

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPageTitleByPageUid.mockImplementation((uid) =>
    uid === PAGE_UID ? LOCAL_TITLE : OTHER_PAGE_TITLE,
  );
  mockedReadImportedSourceIdentity.mockReturnValue({
    sourceModifiedAt: "2026-06-14T12:00:00.000Z",
    sourceNodeRid: sharedNode.rid,
  });
  mockedGetLoggedInClient.mockResolvedValue(client);
  mockedGetSharedNodeByRid.mockResolvedValue(sharedNode);
  mockedResolveSharedNodeTypes.mockResolvedValue(new Map());
  mockedMaterializeSharedNode.mockResolvedValue({
    success: true,
    action: "updated",
    pageUid: PAGE_UID,
    sourceModifiedAt: sharedNode.lastModified,
    sourceNodeRid: sharedNode.rid,
  });
});

describe("refreshImportedNode", () => {
  it("refreshes the page from its stored source identity", async () => {
    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: true,
      message: 'Refreshed "EVD - REM sleep and recall" from Research vault.',
    });
    expect(mockedGetSharedNodeByRid).toHaveBeenCalledWith({
      client,
      rid: sharedNode.rid,
    });
    expect(mockedResolveSharedNodeTypes).toHaveBeenCalledWith({
      client,
      sharedNodes: [sharedNode],
    });
    expect(mockedMaterializeSharedNode).toHaveBeenCalledWith({
      client,
      sharedNode,
      nodeType: undefined,
      force: true,
    });
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("passes the resolved node type to the materializer", async () => {
    mockedResolveSharedNodeTypes.mockResolvedValue(
      new Map([[sharedNode.rid, NODE_TYPE]]),
    );

    await refreshImportedNode({ pageUid: PAGE_UID });

    expect(mockedMaterializeSharedNode).toHaveBeenCalledWith({
      client,
      sharedNode,
      nodeType: NODE_TYPE,
      force: true,
    });
  });

  it("fails when the page has no stored source identity", async () => {
    mockedReadImportedSourceIdentity.mockReturnValue(undefined);

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: `"${LOCAL_TITLE}" has no stored source identity, so it cannot be refreshed.`,
    });
    expect(mockedGetLoggedInClient).not.toHaveBeenCalled();
    expect(mockedMaterializeSharedNode).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("fails when the database client is unavailable", async () => {
    mockedGetLoggedInClient.mockResolvedValue(null);

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: "Could not connect to shared persistence.",
    });
    expect(mockedGetSharedNodeByRid).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("fails when the source node is no longer shared", async () => {
    mockedGetSharedNodeByRid.mockResolvedValue(null);

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: `The source of "${LOCAL_TITLE}" is no longer shared with your groups, so it cannot be refreshed.`,
    });
    expect(mockedMaterializeSharedNode).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("reports the materialization failure message", async () => {
    mockedMaterializeSharedNode.mockResolvedValue({
      success: false,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
      error: {
        message: 'Failed to replace the content of "EVD - old local title"',
        stage: "replace-page-content",
      },
    });

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: 'Failed to replace the content of "EVD - old local title"',
    });
    expect(mockedInternalError).toHaveBeenCalledTimes(1);
    expect(mockedInternalError.mock.calls[0]?.[0]).toMatchObject({
      type: "Imported node refresh failed",
      context: {
        operation: "refresh-imported-node",
        pageUid: PAGE_UID,
        stage: "replace-page-content",
      },
    });
  });

  it("fails when a different page linked to the source was refreshed", async () => {
    mockedMaterializeSharedNode.mockResolvedValue({
      success: true,
      action: "updated",
      pageUid: "other-page-uid",
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: `A different page ("${OTHER_PAGE_TITLE}") is linked to the same source and was refreshed instead.`,
    });
  });

  it("reports an unexpected error", async () => {
    const thrown = new Error("network down");
    mockedGetSharedNodeByRid.mockRejectedValue(thrown);

    await expect(refreshImportedNode({ pageUid: PAGE_UID })).resolves.toEqual({
      success: false,
      message: "Could not refresh this page: network down",
    });
    expect(mockedInternalError).toHaveBeenCalledTimes(1);
    const reported = mockedInternalError.mock.calls[0]?.[0];
    expect(reported?.error).toBe(thrown);
    expect(reported?.type).toBe("Imported node refresh failed");
  });
});
