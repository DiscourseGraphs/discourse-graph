import { describe, expect, it, vi } from "vitest";
import type { DiscoveredSharedNode } from "~/utils/discoverSharedNodes";
import { importSelectedSharedNodes } from "~/utils/importSelectedSharedNodes";

const createNode = ({
  sourceNodeRid,
  title,
}: {
  sourceNodeRid: string;
  title: string;
}): DiscoveredSharedNode => ({
  alreadyImported: false,
  modifiedAt: "2026-06-14T15:00:00.000Z",
  sourceApp: "Obsidian",
  sourceNodeId: sourceNodeRid.split("/").at(-1),
  sourceNodeRid,
  sourceSpaceDatabaseId: 20,
  sourceSpaceId: "obsidian:vault-a",
  sourceSpaceName: "Research vault",
  title,
});

const firstNode = createNode({
  sourceNodeRid: "orn:obsidian.note:vault-a/node-1",
  title: "First node",
});
const secondNode = createNode({
  sourceNodeRid: "orn:obsidian.note:vault-a/node-2",
  title: "Second node",
});
const thirdNode = createNode({
  sourceNodeRid: "orn:obsidian.note:vault-a/node-3",
  title: "Third node",
});

describe("importSelectedSharedNodes", () => {
  it("reports imported, updated, and skipped nodes", async () => {
    const materializeNode = vi
      .fn()
      .mockResolvedValueOnce("imported")
      .mockResolvedValueOnce("updated")
      .mockResolvedValueOnce("skipped");

    await expect(
      importSelectedSharedNodes({
        materializeNode,
        nodes: [firstNode, secondNode, thirdNode],
      }),
    ).resolves.toEqual({
      failed: [],
      imported: 2,
      skipped: 1,
      updated: 1,
    });
    expect(materializeNode.mock.calls).toEqual([
      [firstNode],
      [secondNode],
      [thirdNode],
    ]);
  });

  it("continues importing after an individual node fails", async () => {
    const materializeNode = vi
      .fn()
      .mockRejectedValueOnce(new Error("Markdown could not be imported"))
      .mockResolvedValueOnce("imported")
      .mockRejectedValueOnce("Source content is missing");

    await expect(
      importSelectedSharedNodes({
        materializeNode,
        nodes: [firstNode, secondNode, thirdNode],
      }),
    ).resolves.toEqual({
      failed: [
        {
          message: "Markdown could not be imported",
          node: firstNode,
        },
        {
          message: "Source content is missing",
          node: thirdNode,
        },
      ],
      imported: 1,
      skipped: 0,
      updated: 0,
    });
    expect(materializeNode).toHaveBeenCalledTimes(3);
  });

  it("returns empty counts when no nodes are selected", async () => {
    const materializeNode = vi.fn();

    await expect(
      importSelectedSharedNodes({ materializeNode, nodes: [] }),
    ).resolves.toEqual({
      failed: [],
      imported: 0,
      skipped: 0,
      updated: 0,
    });
    expect(materializeNode).not.toHaveBeenCalled();
  });
});
