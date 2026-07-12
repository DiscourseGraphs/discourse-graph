import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveredSharedNode } from "~/utils/discoverSharedNodes";
import { importDiscoveredSharedNode } from "~/utils/importDiscoveredSharedNode";

const mocks = vi.hoisted(() => ({
  getSharedNodePayload: vi.fn(),
  materializeObsidianNode: vi.fn(),
}));

vi.mock("@repo/database/lib/sharedNodes", () => ({
  getSharedNodePayload: mocks.getSharedNodePayload,
}));
vi.mock("~/utils/materializeObsidianNode", () => ({
  materializeObsidianNode: mocks.materializeObsidianNode,
}));

const node: DiscoveredSharedNode = {
  alreadyImported: false,
  modifiedAt: "2026-06-14T15:00:00.000Z",
  sourceApp: "Obsidian",
  sourceNodeId: "node-1",
  sourceNodeRid: "orn:obsidian.note:vault-a/node-1",
  sourceSpaceDatabaseId: 20,
  sourceSpaceId: "obsidian:vault-a",
  sourceSpaceName: "Research vault",
  title: "EVD - REM sleep and recall",
};
const payload = { localId: "node-1" } as CrossAppNode;
const client = {} as Parameters<typeof importDiscoveredSharedNode>[0]["client"];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSharedNodePayload.mockResolvedValue(payload);
});

describe("importDiscoveredSharedNode", () => {
  it.each([
    ["created", "imported"],
    ["updated", "updated"],
  ] as const)("maps a %s materialization to %s", async (action, status) => {
    mocks.materializeObsidianNode.mockResolvedValue({
      action,
      pageUid: "page-uid",
      sourceModifiedAt: node.modifiedAt,
      sourceNodeRid: node.sourceNodeRid,
      success: true,
    });

    await expect(importDiscoveredSharedNode({ client, node })).resolves.toBe(
      status,
    );
    expect(mocks.getSharedNodePayload).toHaveBeenCalledWith({
      client,
      sourceLocalId: "node-1",
      spaceId: 20,
    });
    expect(mocks.materializeObsidianNode).toHaveBeenCalledWith({
      node: payload,
      sourceModifiedAt: node.modifiedAt,
      sourceNodeRid: node.sourceNodeRid,
    });
  });

  it("surfaces the materializer's actionable failure message", async () => {
    mocks.materializeObsidianNode.mockResolvedValue({
      error: {
        message: "Markdown could not be imported",
        stage: "create-page",
      },
      sourceModifiedAt: node.modifiedAt,
      sourceNodeRid: node.sourceNodeRid,
      success: false,
    });

    await expect(importDiscoveredSharedNode({ client, node })).rejects.toThrow(
      "Markdown could not be imported",
    );
  });

  it("skips non-Obsidian nodes without loading their payload", async () => {
    await expect(
      importDiscoveredSharedNode({
        client,
        node: { ...node, sourceApp: "Roam" },
      }),
    ).resolves.toBe("skipped");
    expect(mocks.getSharedNodePayload).not.toHaveBeenCalled();
  });
});
