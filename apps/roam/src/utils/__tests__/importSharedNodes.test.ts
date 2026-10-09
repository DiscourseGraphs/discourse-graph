import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  importSharedNodes,
  isFailedSharedNodeImport,
} from "~/utils/importSharedNodes";
import { findImportedNodeUidBySourceRid } from "~/utils/importedSourceIdentity";
import { materializeSharedNode } from "~/utils/materializeSharedNode";
import { resolveSharedNodeTypes } from "~/utils/resolveSharedNodeTypes";

// A plain factory rather than `importActual`: loading the real module pulls in
// `internalError`, whose settings-accessor chain reads `window` at module scope. Nothing
// reachable from this test needs the module's other exports.
vi.mock("~/utils/materializeSharedNode", () => ({
  materializeSharedNode: vi.fn(),
}));

vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));

vi.mock("~/utils/resolveSharedNodeTypes", () => ({
  resolveSharedNodeTypes: vi.fn(),
}));

vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
}));

// Runs before the imports above: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

const mockedMaterializeSharedNode = vi.mocked(materializeSharedNode);
const mockedResolveSharedNodeTypes = vi.mocked(resolveSharedNodeTypes);
const mockedFindImportedNodeUidBySourceRid = vi.mocked(
  findImportedNodeUidBySourceRid,
);

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
  mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
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

    const items = await importSharedNodes({
      client,
      sharedNodes,
      discoveredNodes: [],
      onProgress,
    });

    expect(items).toEqual([
      {
        sharedNode: sharedNodes[0],
        status: "imported",
        pageUid: "page-node-1",
      },
      {
        sharedNode: sharedNodes[1],
        status: "imported",
        pageUid: "page-node-2",
      },
      { sharedNode: sharedNodes[2], status: "skipped", pageUid: "page-node-3" },
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

    await importSharedNodes({
      client,
      sharedNodes,
      discoveredNodes: [],
      onProgress: vi.fn(),
    });

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
      discoveredNodes: [],
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

  it("orders a chain of sources across spaces before its dependents", async () => {
    const root = makeSharedNode("root");
    const source = {
      ...makeSharedNode("source"),
      slots: { sourceDocument: root.rid },
    };
    const evidence = {
      ...makeSharedNode("evidence"),
      rid: "orn:obsidian.note:vault-b/evidence",
      spaceUri: "obsidian:vault-b",
      slots: { sourceDocument: source.rid },
    };
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );
    await importSharedNodes({
      client,
      sharedNodes: [evidence, source, root],
      discoveredNodes: [],
      onProgress: vi.fn(),
    });
    expect(
      mockedMaterializeSharedNode.mock.calls.map(([args]) => args.sharedNode),
    ).toEqual([root, source, evidence]);
  });

  it("keeps absent references non-blocking and visits cycles only once", async () => {
    const first = {
      ...makeSharedNode("first"),
      slots: { sourceDocument: "second" },
    };
    const second = {
      ...makeSharedNode("second"),
      slots: { sourceDocument: "first" },
    };
    const missing = {
      ...makeSharedNode("missing"),
      slots: { sourceDocument: "absent" },
    };
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );
    const items = await importSharedNodes({
      client,
      sharedNodes: [first, second, missing],
      discoveredNodes: [],
      onProgress: vi.fn(),
    });
    expect(items.map(({ sharedNode }) => sharedNode.rid)).toEqual([
      second.rid,
      first.rid,
      missing.rid,
    ]);
    expect(mockedMaterializeSharedNode).toHaveBeenCalledTimes(3);
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
      discoveredNodes: [],
      onProgress: vi.fn(),
    });

    expect(items).toEqual([
      {
        sharedNode: sharedNodes[0],
        status: "imported",
        pageUid: "page-node-1",
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
      discoveredNodes: [],
      onProgress: vi.fn(),
    });

    expect(items).toEqual([
      {
        sharedNode: sharedNodes[0],
        status: "failed",
        message: "roam api unavailable",
      },
      {
        sharedNode: sharedNodes[1],
        status: "imported",
        pageUid: "page-node-2",
      },
    ]);
  });
  it("imports a discovered source this graph lacks before the node that names it", async () => {
    const source = {
      ...makeSharedNode("source"),
      rid: "orn:obsidian.note:vault-b/source",
      spaceUri: "obsidian:vault-b",
    };
    const evidence = {
      ...makeSharedNode("evidence"),
      slots: { sourceDocument: source.rid },
    };
    const other = makeSharedNode("other");
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );
    const onProgress = vi.fn();

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence],
      discoveredNodes: [evidence, source, other],
      onProgress,
    });

    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      source.rid,
    );
    expect(mockedResolveSharedNodeTypes).toHaveBeenCalledWith({
      client,
      sharedNodes: [evidence, source],
    });
    expect(
      mockedMaterializeSharedNode.mock.calls.map(([args]) => args.sharedNode),
    ).toEqual([source, evidence]);
    expect(items).toEqual([
      { sharedNode: source, status: "imported", pageUid: "page-source" },
      { sharedNode: evidence, status: "imported", pageUid: "page-evidence" },
    ]);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("reuses a source this graph already imported", async () => {
    const source = makeSharedNode("source");
    const evidence = {
      ...makeSharedNode("evidence"),
      slots: { sourceDocument: source.sourceLocalId },
    };
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue("source-page-uid");
    mockedMaterializeSharedNode.mockResolvedValueOnce(
      successResult(evidence, "created"),
    );

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence],
      discoveredNodes: [evidence, source],
      onProgress: vi.fn(),
    });

    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      source.rid,
    );
    expect(items).toEqual([
      { sharedNode: evidence, status: "imported", pageUid: "page-evidence" },
    ]);
  });

  it("does not add a source that is selected", async () => {
    const source = makeSharedNode("source");
    const evidence = {
      ...makeSharedNode("evidence"),
      slots: { sourceDocument: source.sourceLocalId },
    };
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence, source],
      discoveredNodes: [evidence, source],
      onProgress: vi.fn(),
    });

    expect(mockedFindImportedNodeUidBySourceRid).not.toHaveBeenCalled();
    expect(items.map((item) => item.sharedNode)).toEqual([source, evidence]);
  });

  it("leaves a source the discovery did not list to the materializer", async () => {
    const evidence = {
      ...makeSharedNode("evidence"),
      slots: { sourceDocument: "orn:obsidian.note:vault-b/source" },
    };
    mockedMaterializeSharedNode.mockResolvedValueOnce(
      successResult(evidence, "created"),
    );

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence],
      discoveredNodes: [evidence],
      onProgress: vi.fn(),
    });

    expect(mockedFindImportedNodeUidBySourceRid).not.toHaveBeenCalled();
    expect(mockedMaterializeSharedNode).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      { sharedNode: evidence, status: "imported", pageUid: "page-evidence" },
    ]);
  });

  it("adds a source once when several nodes name it by a bare id", async () => {
    const source = makeSharedNode("source");
    const first = {
      ...makeSharedNode("first"),
      slots: { sourceDocument: source.sourceLocalId },
    };
    const second = {
      ...makeSharedNode("second"),
      slots: { sourceDocument: source.sourceLocalId },
    };
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );

    const items = await importSharedNodes({
      client,
      sharedNodes: [first, second],
      discoveredNodes: [first, second, source],
      onProgress: vi.fn(),
    });

    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledTimes(1);
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      source.rid,
    );
    expect(items.map((item) => item.sharedNode)).toEqual([
      source,
      first,
      second,
    ]);
  });
  it("adds the source and keeps importing when its identity lookup rejects", async () => {
    const source = makeSharedNode("source");
    const evidence = {
      ...makeSharedNode("evidence"),
      slots: { sourceDocument: source.sourceLocalId },
    };
    mockedFindImportedNodeUidBySourceRid.mockRejectedValue(
      new Error("roam api unavailable"),
    );
    mockedMaterializeSharedNode.mockImplementation(({ sharedNode }) =>
      Promise.resolve(successResult(sharedNode, "created")),
    );
    const onProgress = vi.fn();

    const items = await importSharedNodes({
      client,
      sharedNodes: [evidence],
      discoveredNodes: [evidence, source],
      onProgress,
    });

    expect(items.map((item) => item.sharedNode)).toEqual([source, evidence]);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
