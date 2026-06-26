import { describe, expect, it } from "vitest";
import {
  ridToSpaceUriAndLocalId,
  spaceUriAndLocalIdToRid,
} from "@repo/database/lib/rid";
import { assembleDiscoveredNodes } from "~/utils/discoverSharedNodes";

const ROAM_URL = "https://roamresearch.com/#/app/MAPLab";
const OBSIDIAN_URL = "obsidian:9a8b7c6d5e4f3210";

const spaceMeta: Map<
  number,
  { url: string; name: string | null; platform: string | null }
> = new Map([
  [1, { url: ROAM_URL, name: "MAP Lab", platform: "Roam" }],
  [2, { url: OBSIDIAN_URL, name: "Field Vault", platform: "Obsidian" }],
]);

const row = (
  space_id: number,
  source_local_id: string,
  variant: string,
  text: string | null,
  last_modified: string | null,
) => ({ space_id, source_local_id, variant, text, last_modified });

describe("assembleDiscoveredNodes", () => {
  it("merges direct + full into one node, preferring direct for the title", () => {
    const result = assembleDiscoveredNodes({
      contentRows: [
        row(1, "abc", "direct", "Sleep improves memory", "2026-06-12T10:00:00"),
        row(
          1,
          "abc",
          "full",
          "# Sleep improves memory\n\nbody",
          "2026-06-12T12:00:00",
        ),
      ],
      spaceMetaById: spaceMeta,
      importedRids: new Set(),
    });

    expect(result).toHaveLength(1);
    const node = result[0]!;
    expect(node.title).toBe("Sleep improves memory");
    expect(node.sourceApp).toBe("roam");
    expect(node.sourceSpaceId).toBe(ROAM_URL);
    expect(node.sourceSpaceName).toBe("MAP Lab");
    expect(node.sourceNodeId).toBe("abc");
    expect(node.alreadyImported).toBe(false);
    expect(node.sourceModifiedAt).toBe(
      new Date("2026-06-12T12:00:00Z").toISOString(),
    );
    expect(node.sourceNodeRid).toBe(spaceUriAndLocalIdToRid(ROAM_URL, "abc"));
    expect(ridToSpaceUriAndLocalId(node.sourceNodeRid)).toEqual({
      spaceUri: ROAM_URL,
      sourceLocalId: "abc",
    });
  });

  it("skips title-only nodes that have no full variant (not actually shared)", () => {
    const result = assembleDiscoveredNodes({
      contentRows: [
        row(1, "title-only", "direct", "Just a title", "2026-06-12T10:00:00"),
      ],
      spaceMetaById: spaceMeta,
      importedRids: new Set(),
    });
    expect(result).toHaveLength(0);
  });

  it("skips nodes whose source space metadata is missing", () => {
    const result = assembleDiscoveredNodes({
      contentRows: [
        row(99, "x", "direct", "Title", "2026-06-12T10:00:00"),
        row(99, "x", "full", "body", "2026-06-12T10:00:00"),
      ],
      spaceMetaById: spaceMeta,
      importedRids: new Set(),
    });
    expect(result).toHaveLength(0);
  });

  it("marks already-imported nodes by source RID", () => {
    const contentRows = [
      row(2, "node-1", "direct", "Field note", "2026-06-12T10:00:00"),
      row(2, "node-1", "full", "body", "2026-06-12T10:00:00"),
    ];
    const rid = spaceUriAndLocalIdToRid(OBSIDIAN_URL, "node-1");
    const result = assembleDiscoveredNodes({
      contentRows,
      spaceMetaById: spaceMeta,
      importedRids: new Set([rid]),
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceApp).toBe("obsidian");
    expect(result[0]!.alreadyImported).toBe(true);
  });

  it("sorts nodes by source space name", () => {
    const result = assembleDiscoveredNodes({
      contentRows: [
        row(2, "o1", "direct", "Obsidian node", "2026-06-12T10:00:00"),
        row(2, "o1", "full", "body", "2026-06-12T10:00:00"),
        row(1, "r1", "direct", "Roam node", "2026-06-12T10:00:00"),
        row(1, "r1", "full", "body", "2026-06-12T10:00:00"),
      ],
      spaceMetaById: spaceMeta,
      importedRids: new Set(),
    });
    expect(result.map((n) => n.sourceSpaceName)).toEqual([
      "Field Vault",
      "MAP Lab",
    ]);
  });
});
