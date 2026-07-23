import { describe, expect, it } from "vitest";
import { toDiscoveredSharedNodes } from "~/utils/discoverSharedNodes";
import type { SharedNode } from "@repo/database/lib/sharedNodes";

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

describe("toDiscoveredSharedNodes", () => {
  it("maps a shared node to the exact discovered shared node shape", () => {
    expect(
      toDiscoveredSharedNodes({
        sharedNodes: [sharedNode],
        importedSourceRids: new Set([sharedNode.rid]),
      }),
    ).toEqual([
      {
        alreadyImported: true,
        modifiedAt: "2026-06-14T15:00:00.000Z",
        sourceApp: "Obsidian",
        sourceNodeId: "node-1",
        sourceNodeRid: "orn:obsidian.note:vault-a/node-1",
        sourceSpaceId: "obsidian:vault-a",
        sourceSpaceName: "Research vault",
        title: "EVD - REM sleep and recall",
      },
    ]);
  });

  it("matches imports by RID rather than source-local ID alone", () => {
    expect(
      toDiscoveredSharedNodes({
        sharedNodes: [sharedNode],
        importedSourceRids: new Set(["orn:obsidian.note:another-vault/node-1"]),
      })[0]?.alreadyImported,
    ).toBe(false);
  });
});
