import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { DbCrossAppNode } from "@repo/database/lib/dbToCrossAppConverters";
import {
  getNodeTypeRid,
  getSharedNodeByRid,
  type SharedNodeSpace,
} from "@repo/database/lib/sharedNodes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { readImportedSourceIdentity } from "~/utils/importedSourceIdentity";
import internalError from "~/utils/internalError";
import { materializeSharedNode } from "~/utils/materializeSharedNode";
import { refreshImportedNode } from "~/utils/refreshImportedNode";
import { resolveSharedNodeTypes } from "~/utils/resolveSharedNodeTypes";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import { importSharedRelations } from "~/utils/importSharedRelations";

vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: vi.fn(),
}));
vi.mock("@repo/database/lib/sharedNodes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/database/lib/sharedNodes")>()),
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
  getSupabaseContext: vi.fn(),
}));
vi.mock("~/utils/importSharedRelations", () => ({
  importSharedRelations: vi.fn(),
}));

// Runs before the imports above: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

const mockedGetPageTitleByPageUid = vi.mocked(getPageTitleByPageUid);
const mockedGetSharedNodeByRid = vi.mocked(getSharedNodeByRid);
const mockedReadImportedSourceIdentity = vi.mocked(readImportedSourceIdentity);
const mockedInternalError = vi.mocked(internalError);
const mockedMaterializeSharedNode = vi.mocked(materializeSharedNode);
const mockedGetLoggedInClient = vi.mocked(getLoggedInClient);
const mockedResolveSharedNodeTypes = vi.mocked(resolveSharedNodeTypes);
const mockedGetSupabaseContext = vi.mocked(getSupabaseContext);
const mockedImportSharedRelations = vi.mocked(importSharedRelations);

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

const sharedNode: DbCrossAppNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  localId: "node-1",
  nodeType: "evd-type",
  coreTitle: "REM sleep and recall",
  content: { direct: { value: "EVD - REM sleep and recall" } },
  createdAt: new Date("2026-06-14T12:30:00.000Z"),
  modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
  authorId: "account-7",
};

const space: SharedNodeSpace = {
  id: 20,
  name: "Research vault",
  platform: "Obsidian",
  url: "obsidian:vault-a",
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
  mockedGetSupabaseContext.mockResolvedValue({ spaceId: 5 } as Awaited<
    ReturnType<typeof getSupabaseContext>
  >);
  mockedImportSharedRelations.mockResolvedValue({ failures: [], skipped: [] });
  mockedGetSharedNodeByRid.mockResolvedValue({ node: sharedNode, space });
  mockedResolveSharedNodeTypes.mockResolvedValue(new Map());
  mockedMaterializeSharedNode.mockResolvedValue({
    success: true,
    action: "updated",
    pageUid: PAGE_UID,
    sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
    sourceNodeRid: sharedNode.rid,
  });
});

describe("refreshImportedNode", () => {
  it("imports relations after refreshing, including when the node was up to date", async () => {
    await refreshImportedNode({ pageUid: PAGE_UID, force: true });
    expect(mockedImportSharedRelations).toHaveBeenCalledWith(client, 5);

    mockedImportSharedRelations.mockClear();
    mockedMaterializeSharedNode.mockResolvedValue({
      success: true,
      action: "skipped",
      pageUid: PAGE_UID,
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
    });
    await refreshImportedNode({ pageUid: PAGE_UID, force: false });
    expect(mockedImportSharedRelations).toHaveBeenCalledWith(client, 5);
  });

  it("does not import relations when asked not to", async () => {
    await refreshImportedNode({
      pageUid: PAGE_UID,
      force: false,
      importRelations: false,
    });
    expect(mockedImportSharedRelations).not.toHaveBeenCalled();
  });

  it("reports relations that failed to import as a warning, not a failure", async () => {
    mockedImportSharedRelations.mockResolvedValue({
      failures: ["a: broken", "b: broken"],
      skipped: ["c: hidden"],
    });
    mockedMaterializeSharedNode.mockResolvedValue({
      success: true,
      action: "updated",
      pageUid: PAGE_UID,
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
      warning: "No source was published with this node.",
    });

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "refreshed",
      message: 'Refreshed "EVD - REM sleep and recall" from Research vault.',
      warning:
        "No source was published with this node. 2 relations could not be imported.",
    });
  });

  it("does not warn about relations skipped for a hidden schema", async () => {
    mockedImportSharedRelations.mockResolvedValue({
      failures: [],
      skipped: ["c: hidden"],
    });

    const result = await refreshImportedNode({
      pageUid: PAGE_UID,
      force: true,
    });

    expect(result.status).toBe("refreshed");
    expect(result).not.toHaveProperty("warning");
  });

  it("keeps the refresh when the relation import throws", async () => {
    mockedImportSharedRelations.mockRejectedValue(new Error("network down"));

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "refreshed",
      message: 'Refreshed "EVD - REM sleep and recall" from Research vault.',
      warning: "Could not import relations: network down",
    });
  });

  it("refreshes the page from its stored source identity", async () => {
    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "refreshed",
      message: 'Refreshed "EVD - REM sleep and recall" from Research vault.',
    });
    expect(mockedGetSharedNodeByRid).toHaveBeenCalledWith({
      client,
      rid: sharedNode.rid,
    });
    expect(mockedResolveSharedNodeTypes).toHaveBeenCalledWith({
      client,
      sharedNodes: [sharedNode],
      spaces: { [space.url]: space },
    });
    expect(mockedMaterializeSharedNode).toHaveBeenCalledWith({
      client,
      sharedNode,
      space,
      nodeType: undefined,
      force: true,
    });
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("passes the materializer's warning through", async () => {
    mockedMaterializeSharedNode.mockResolvedValue({
      success: true,
      action: "updated",
      pageUid: PAGE_UID,
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
      warning: "No source was published with this node.",
    });

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "refreshed",
      message: 'Refreshed "EVD - REM sleep and recall" from Research vault.',
      warning: "No source was published with this node.",
    });
  });

  it("passes the resolved node type to the materializer", async () => {
    mockedResolveSharedNodeTypes.mockResolvedValue(
      new Map([[getNodeTypeRid(sharedNode), NODE_TYPE]]),
    );

    await refreshImportedNode({ pageUid: PAGE_UID, force: true });

    expect(mockedMaterializeSharedNode).toHaveBeenCalledWith({
      client,
      sharedNode,
      space,
      nodeType: NODE_TYPE,
      force: true,
    });
  });

  it("skips an up-to-date import when not forced", async () => {
    mockedMaterializeSharedNode.mockResolvedValue({
      success: true,
      action: "skipped",
      pageUid: PAGE_UID,
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
    });

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: false }),
    ).resolves.toEqual({
      status: "skipped",
      message: '"EVD - REM sleep and recall" is already up to date.',
    });
    expect(mockedMaterializeSharedNode).toHaveBeenCalledWith({
      client,
      sharedNode,
      space,
      nodeType: undefined,
      force: false,
    });
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("fails when the page has no stored source identity", async () => {
    mockedReadImportedSourceIdentity.mockReturnValue(undefined);

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
      message: `"${LOCAL_TITLE}" has no stored source identity, so it cannot be refreshed.`,
    });
    expect(mockedGetLoggedInClient).not.toHaveBeenCalled();
    expect(mockedMaterializeSharedNode).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("fails when the database client is unavailable", async () => {
    mockedGetLoggedInClient.mockResolvedValue(null);

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
      message: "Could not connect to shared persistence.",
    });
    expect(mockedGetSharedNodeByRid).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("fails when the source node is no longer shared", async () => {
    mockedGetSharedNodeByRid.mockResolvedValue(null);

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
      message: `The source of "${LOCAL_TITLE}" is no longer shared with your groups, so it cannot be refreshed.`,
    });
    expect(mockedMaterializeSharedNode).not.toHaveBeenCalled();
    expect(mockedInternalError).not.toHaveBeenCalled();
  });

  it("reports the materialization failure message", async () => {
    mockedMaterializeSharedNode.mockResolvedValue({
      success: false,
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
      error: {
        message: 'Failed to replace the content of "EVD - old local title"',
        stage: "replace-page-content",
      },
    });

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
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
      sourceModifiedAt: sharedNode.modifiedAt.toISOString(),
      sourceNodeRid: sharedNode.rid,
    });

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
      message: `A different page ("${OTHER_PAGE_TITLE}") is linked to the same source and was refreshed instead.`,
    });
  });

  it("reports an unexpected error", async () => {
    const thrown = new Error("network down");
    mockedGetSharedNodeByRid.mockRejectedValue(thrown);

    await expect(
      refreshImportedNode({ pageUid: PAGE_UID, force: true }),
    ).resolves.toEqual({
      status: "failed",
      message: "Could not refresh this page: network down",
    });
    expect(mockedInternalError).toHaveBeenCalledTimes(1);
    const reported = mockedInternalError.mock.calls[0]?.[0];
    expect(reported?.error).toBe(thrown);
    expect(reported?.type).toBe("Imported node refresh failed");
  });
});
