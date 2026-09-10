import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  importSharedNodes,
  isFailedSharedNodeImport,
} from "~/utils/importSharedNodes";
import { materializeSharedNode } from "~/utils/materializeSharedNode";
import { resolveSharedNodeTypes } from "~/utils/resolveSharedNodeTypes";

vi.mock("~/utils/materializeSharedNode", async () => {
  const actual = await vi.importActual<
    typeof import("~/utils/materializeSharedNode")
  >("~/utils/materializeSharedNode");
  return { ...actual, materializeSharedNode: vi.fn() };
});

vi.mock("~/utils/resolveSharedNodeTypes", () => ({
  resolveSharedNodeTypes: vi.fn(),
}));

// Runs before the imports above: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

const mockedMaterializeSharedNode = vi.mocked(materializeSharedNode);
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

const client = {} as DGSupabaseClient;

const makeSharedNode = (sourceLocalId: string): SharedNode => ({
  rid: `orn:obsidian.note:vault-a/${sourceLocalId}`,
  sourceLocalId,
  schemaId: 200,
  spaceId: 20,
  spaceName: "Research vault",
  spaceUri: "obsidian:vault-a",
  platform: "Obsidian",
  title: `EVD - ${sourceLocalId}`,
  created: "2026-06-14T12:30:00.000Z",
  lastModified: "2026-06-14T15:00:00.000Z",
  authorId: 7,
  directMetadata: null,
});

const successResult = (
  sharedNode: SharedNode,
  action: "created" | "updated" | "skipped",
) => ({
  success: true as const,
  action,
  pageUid: `page-${sharedNode.sourceLocalId}`,
  sourceModifiedAt: sharedNode.lastModified,
  sourceNodeRid: sharedNode.rid,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedResolveSharedNodeTypes.mockResolvedValue(new Map());
});

describe("importSharedNodes", () => {
  it("reports one outcome per node and progress after each", async () => {
    const sharedNodes = ["node-1", "node-2", "node-3", "node-4"].map(
      makeSharedNode,
    );
    mockedMaterializeSharedNode
      .mockResolvedValueOnce(successResult(sharedNodes[0], "created"))
      .mockResolvedValueOnce(successResult(sharedNodes[1], "updated"))
      .mockResolvedValueOnce(successResult(sharedNodes[2], "skipped"))
      .mockResolvedValueOnce({
        success: false,
        sourceModifiedAt: sharedNodes[3].lastModified,
        sourceNodeRid: sharedNodes[3].rid,
        error: { message: "title collision", stage: "title-collision" },
      });
    const onProgress = vi.fn();

    const items = await importSharedNodes({ client, sharedNodes, onProgress });

    expect(items).toEqual([
      { sharedNode: sharedNodes[0], status: "imported" },
      { sharedNode: sharedNodes[1], status: "imported" },
      { sharedNode: sharedNodes[2], status: "skipped" },
      {
        sharedNode: sharedNodes[3],
        status: "failed",
        message: "title collision",
      },
    ]);
    expect(items.filter(isFailedSharedNodeImport)).toEqual([items[3]]);
    expect(onProgress.mock.calls).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
    expect(mockedMaterializeSharedNode).toHaveBeenNthCalledWith(1, {
      client,
      sharedNode: sharedNodes[0],
    });
  });

  it("resolves node types once and gives each node the one for its schema", async () => {
    const sharedNodes = [
      makeSharedNode("node-1"),
      { ...makeSharedNode("node-2"), schemaId: 300 },
    ];
    mockedResolveSharedNodeTypes.mockResolvedValue(
      new Map([[sharedNodes[0].schemaId, NODE_TYPE]]),
    );
    mockedMaterializeSharedNode
      .mockResolvedValueOnce(successResult(sharedNodes[0], "created"))
      .mockResolvedValueOnce(successResult(sharedNodes[1], "created"));

    await importSharedNodes({ client, sharedNodes, onProgress: vi.fn() });

    expect(mockedResolveSharedNodeTypes).toHaveBeenCalledTimes(1);
    expect(mockedResolveSharedNodeTypes).toHaveBeenCalledWith({
      client,
      sharedNodes,
    });
    expect(mockedMaterializeSharedNode).toHaveBeenNthCalledWith(1, {
      client,
      sharedNode: sharedNodes[0],
      nodeType: NODE_TYPE,
    });
    expect(mockedMaterializeSharedNode).toHaveBeenNthCalledWith(2, {
      client,
      sharedNode: sharedNodes[1],
      nodeType: undefined,
    });
  });

  it("materializes a node before the nodes that name it as their source", async () => {
    const evidence = {
      ...makeSharedNode("node-1"),
      slots: { sourceDocument: "node-2" },
    };
    const source = makeSharedNode("node-2");
    const other = makeSharedNode("node-3");
    mockedMaterializeSharedNode
      .mockResolvedValueOnce(successResult(source, "created"))
      .mockResolvedValueOnce(successResult(evidence, "created"))
      .mockResolvedValueOnce(successResult(other, "created"));

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence, source, other],
      onProgress: vi.fn(),
    });

    expect(
      mockedMaterializeSharedNode.mock.calls.map(([args]) => args.sharedNode),
    ).toEqual([source, evidence, other]);
    expect(items.map((item) => item.sharedNode)).toEqual([
      source,
      evidence,
      other,
    ]);
  });

  it("reports the materializer's warning on the imported node", async () => {
    const sharedNodes = [makeSharedNode("node-1")];
    mockedMaterializeSharedNode.mockResolvedValueOnce({
      ...successResult(sharedNodes[0], "created"),
      warning: "No source was published with this node.",
    });

    const items = await importSharedNodes({
      client,
      sharedNodes,
      onProgress: vi.fn(),
    });

    expect(items).toEqual([
      {
        sharedNode: sharedNodes[0],
        status: "imported",
        warning: "No source was published with this node.",
      },
    ]);
  });

  it("keeps importing the remaining nodes when a materialization throws", async () => {
    const sharedNodes = ["node-1", "node-2"].map(makeSharedNode);
    mockedMaterializeSharedNode
      .mockRejectedValueOnce(new Error("roam api unavailable"))
      .mockResolvedValueOnce(successResult(sharedNodes[1], "created"));

    const items = await importSharedNodes({
      client,
      sharedNodes,
      onProgress: vi.fn(),
    });

    expect(items).toEqual([
      {
        sharedNode: sharedNodes[0],
        status: "failed",
        message: "roam api unavailable",
      },
      { sharedNode: sharedNodes[1], status: "imported" },
    ]);
  });
});
