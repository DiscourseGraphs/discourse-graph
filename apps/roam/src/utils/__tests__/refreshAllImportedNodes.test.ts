import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImportedNodeUids } from "~/utils/importedSourceIdentity";
import { refreshAllImportedNodes } from "~/utils/refreshAllImportedNodes";
import {
  importRelationsAfterRefresh,
  refreshImportedNode,
} from "~/utils/refreshImportedNode";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getLoggedInClient } from "~/utils/supabaseContext";

vi.mock("~/utils/importedSourceIdentity", () => ({
  getImportedNodeUids: vi.fn(),
}));
vi.mock("~/utils/refreshImportedNode", () => ({
  refreshImportedNode: vi.fn(),
  importRelationsAfterRefresh: vi.fn(),
}));
vi.mock("~/utils/supabaseContext", () => ({ getLoggedInClient: vi.fn() }));

const mockedGetImportedNodeUids = vi.mocked(getImportedNodeUids);
const mockedRefreshImportedNode = vi.mocked(refreshImportedNode);
const mockedImportRelationsAfterRefresh = vi.mocked(
  importRelationsAfterRefresh,
);
const client = {} as DGSupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLoggedInClient).mockResolvedValue(client);
  mockedImportRelationsAfterRefresh.mockResolvedValue(undefined);
});

describe("refreshAllImportedNodes", () => {
  it("refreshes every imported node without forcing and tallies the outcomes", async () => {
    mockedGetImportedNodeUids.mockResolvedValue(
      new Set(["uid-1", "uid-2", "uid-3", "uid-4"]),
    );
    mockedRefreshImportedNode
      .mockResolvedValueOnce({ status: "refreshed", message: "Refreshed." })
      .mockResolvedValueOnce({ status: "skipped", message: "Up to date." })
      .mockResolvedValueOnce({ status: "failed", message: "Not shared." })
      .mockResolvedValueOnce({ status: "refreshed", message: "Refreshed." });

    await expect(refreshAllImportedNodes()).resolves.toEqual({
      refreshed: 2,
      skipped: 1,
      failed: 1,
      warnings: [],
    });
    expect(mockedRefreshImportedNode.mock.calls).toEqual([
      [{ pageUid: "uid-1", force: false, importRelations: false }],
      [{ pageUid: "uid-2", force: false, importRelations: false }],
      [{ pageUid: "uid-3", force: false, importRelations: false }],
      [{ pageUid: "uid-4", force: false, importRelations: false }],
    ]);
    expect(mockedImportRelationsAfterRefresh).toHaveBeenCalledOnce();
    expect(mockedImportRelationsAfterRefresh).toHaveBeenCalledWith(client);
  });

  it("adds the relation import warning to the refresh warnings", async () => {
    mockedGetImportedNodeUids.mockResolvedValue(new Set(["uid-1"]));
    mockedRefreshImportedNode.mockResolvedValue({
      status: "skipped",
      message: "Up to date.",
    });
    mockedImportRelationsAfterRefresh.mockResolvedValue(
      "1 relation could not be imported.",
    );

    await expect(refreshAllImportedNodes()).resolves.toEqual({
      refreshed: 0,
      skipped: 1,
      failed: 0,
      warnings: ["1 relation could not be imported."],
    });
  });

  it("does not import relations when every refresh failed", async () => {
    mockedGetImportedNodeUids.mockResolvedValue(new Set(["uid-1"]));
    mockedRefreshImportedNode.mockResolvedValue({
      status: "failed",
      message: "Not shared.",
    });

    await refreshAllImportedNodes();

    expect(mockedImportRelationsAfterRefresh).not.toHaveBeenCalled();
  });

  it("returns zero counts when the graph has no imported nodes", async () => {
    mockedGetImportedNodeUids.mockResolvedValue(new Set());

    await expect(refreshAllImportedNodes()).resolves.toEqual({
      refreshed: 0,
      skipped: 0,
      failed: 0,
      warnings: [],
    });
    expect(mockedRefreshImportedNode).not.toHaveBeenCalled();
  });

  it("preserves source warnings alongside successful refresh counts", async () => {
    mockedGetImportedNodeUids.mockResolvedValue(new Set(["uid-1", "uid-2"]));
    mockedRefreshImportedNode
      .mockResolvedValueOnce({
        status: "refreshed",
        message: 'Refreshed "Evidence" from Research vault.',
        warning:
          "Its source is not in this graph, so its title was kept as published.",
      })
      .mockResolvedValueOnce({ status: "refreshed", message: "Refreshed." });

    await expect(refreshAllImportedNodes()).resolves.toEqual({
      refreshed: 2,
      skipped: 0,
      failed: 0,
      warnings: [
        'Refreshed "Evidence" from Research vault. Its source is not in this graph, so its title was kept as published.',
      ],
    });
  });
});
