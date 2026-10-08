import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import type { RelationInstance } from "~/types";
import type { DiscourseNodeInVault } from "~/utils/getDiscourseNodes";
import type { SupabaseContext } from "~/utils/supabaseContext";
import type { TFile } from "obsidian";
import {
  ensurePartialSpaceAccess,
  getAvailableGroupIds,
  getPublishedGroupIdsByRid,
} from "@repo/database/lib/groups";
import {
  ensurePublishedRelationsAccuracy,
  getPublishedGroupsByNode,
  publishNewRelation,
  publishNodeRelations,
  publishNodeToGroup,
} from "~/utils/publishNode";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  findEmbeddedAttachments,
  syncAllNodesAndRelations,
} from "~/utils/syncDgNodesToSupabase";
import {
  getFileForNodeInstanceId,
  getFileForNodeInstanceIds,
  getRelationsForNodeInstanceId,
  loadRelations,
  saveRelations,
} from "~/utils/relationsStore";

vi.mock("@repo/database/lib/groups", () => ({
  ensurePartialSpaceAccess: vi.fn(),
  getAvailableGroupIds: vi.fn(),
  getPublishedGroupIdsByRid: vi.fn(),
}));

vi.mock("~/utils/relationsStore", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveRelations: vi.fn(),
  getRelationsForNodeInstanceId: vi.fn(),
  getFileForNodeInstanceIds: vi.fn(),
  loadRelations: vi.fn(),
  getFileForNodeInstanceId: vi.fn(),
}));

vi.mock("~/utils/supabaseContext", () => ({
  getLoggedInClient: vi.fn(),
  getSupabaseContext: vi.fn(),
}));

vi.mock("~/utils/syncDgNodesToSupabase", () => ({
  syncAllNodesAndRelations: vi.fn(),
  findEmbeddedAttachments: vi.fn(),
  syncPublishedNodeAssets: vi.fn(),
}));

const SPACE_ID = 7;
const IMPORTED_RID = "orn:obsidian.note:other-vault/imported-node";
const OTHER_IMPORTED_RID = "orn:obsidian.note:other-vault/other-imported-node";

const client = {} as DGSupabaseClient;

beforeEach(() => {
  vi.mocked(getPublishedGroupIdsByRid).mockReset();
  vi.mocked(getAvailableGroupIds).mockReset();
  vi.mocked(ensurePartialSpaceAccess).mockReset();
  vi.mocked(ensurePartialSpaceAccess).mockImplementation(({ groupIds }) =>
    Promise.resolve({
      existing: Object.fromEntries(groupIds.map((g) => [g, "partial"])),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const failSpaceAccess = (): void => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(ensurePartialSpaceAccess).mockImplementation(({ groupIds }) =>
    Promise.resolve({
      existing: {},
      missing: Object.fromEntries(groupIds.map((g) => [g, "partial"])),
    }),
  );
};

describe("getPublishedGroupsByNode", () => {
  it("reads a local node's groups from its frontmatter", async () => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({});

    const groups = await getPublishedGroupsByNode({
      client,
      frontmatterByNode: { local: { publishedToGroups: ["g1", "g2"] } },
    });

    expect(groups).toEqual({ local: new Set(["g1", "g2"]) });
    expect(getPublishedGroupIdsByRid).toHaveBeenCalledWith({
      client,
      rids: [],
    });
  });

  it("asks the shared check for an imported node's groups, ignoring its frontmatter", async () => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
    });

    const groups = await getPublishedGroupsByNode({
      client,
      frontmatterByNode: {
        imported: { importedFromRid: IMPORTED_RID, publishedToGroups: ["g2"] },
      },
    });

    expect(groups).toEqual({ imported: new Set(["g1"]) });
  });

  it("looks up a rid shared by two nodes once", async () => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
    });

    const groups = await getPublishedGroupsByNode({
      client,
      frontmatterByNode: {
        first: { importedFromRid: IMPORTED_RID },
        second: { importedFromRid: IMPORTED_RID },
      },
    });

    expect(groups).toEqual({
      first: new Set(["g1"]),
      second: new Set(["g1"]),
    });
    expect(getPublishedGroupIdsByRid).toHaveBeenCalledWith({
      client,
      rids: [IMPORTED_RID],
    });
  });

  it("gives no groups to an imported node the shared check does not return", async () => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({});

    const groups = await getPublishedGroupsByNode({
      client,
      frontmatterByNode: { imported: { importedFromRid: IMPORTED_RID } },
    });

    expect(groups).toEqual({ imported: new Set() });
  });
});

type Call = { table: string; operation: string; args: unknown[] };

// Builder methods chain; awaiting records the call and resolves per table and operation.
const createFakeClient = ({
  syncedRelationIds,
  grantedLocalIdsByGroup,
  failingWriteTables = [],
}: {
  syncedRelationIds: string[];
  grantedLocalIdsByGroup: Record<string, string[]>;
  failingWriteTables?: string[];
}): { client: DGSupabaseClient; calls: Call[] } => {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, operation: "", args: [] };
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {};
    for (const operation of ["select", "delete", "upsert"]) {
      builder[operation] = (...args: unknown[]) => {
        call.operation = operation;
        call.args = args;
        return builder;
      };
    }
    builder.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    };
    builder.in = () => builder;
    builder.maybeSingle = () => builder;
    builder.then = (resolve: (result: unknown) => void) => {
      calls.push(call);
      if (call.operation !== "select")
        return resolve({
          error: failingWriteTables.includes(table)
            ? { code: "42501", message: "denied" }
            : null,
        });
      if (table === "my_contents")
        return resolve({
          data: { last_modified: "2026-01-01T00:00:00" },
          error: null,
        });
      const ids =
        table === "Concept"
          ? syncedRelationIds
          : (grantedLocalIdsByGroup[filters.account_uid as string] ?? []);
      resolve({
        data: ids.map((source_local_id) => ({ source_local_id })),
        error: null,
      });
    };
    return builder;
  };
  return { client: { from } as unknown as DGSupabaseClient, calls };
};

const node = (
  nodeInstanceId: string,
  frontmatter: Record<string, unknown>,
): DiscourseNodeInVault =>
  ({
    nodeInstanceId,
    nodeTypeId: "claim",
    frontmatter,
    file: { basename: nodeInstanceId },
  }) as unknown as DiscourseNodeInVault;

const relation = (
  id: string,
  source: string,
  destination: string,
): RelationInstance => ({
  id,
  type: "supports",
  source,
  destination,
  created: 0,
});

const allNodesById = Object.fromEntries(
  [
    node("localG1", { publishedToGroups: ["g1"] }),
    node("localG2", { publishedToGroups: ["g2"] }),
    node("imported", { importedFromRid: IMPORTED_RID }),
    node("otherImported", { importedFromRid: OTHER_IMPORTED_RID }),
  ].map((n) => [n.nodeInstanceId, n]),
);

const runAccuracyCheck = async ({
  relations,
  grantedLocalIdsByGroup = {},
}: {
  relations: RelationInstance[];
  grantedLocalIdsByGroup?: Record<string, string[]>;
}): Promise<Call[]> => {
  vi.mocked(getAvailableGroupIds).mockResolvedValue(["g1", "g2"]);
  const fake = createFakeClient({
    syncedRelationIds: relations.map((r) => r.id),
    grantedLocalIdsByGroup,
  });
  await ensurePublishedRelationsAccuracy({
    client: fake.client,
    context: { spaceId: SPACE_ID } as SupabaseContext,
    plugin: {} as DiscourseGraphPlugin,
    allNodesById,
    relationInstancesData: {
      version: 1,
      lastModified: 0,
      relations: Object.fromEntries(relations.map((r) => [r.id, r])),
    },
  });
  return fake.calls;
};

const upsertedRows = (calls: Call[]): unknown =>
  calls
    .filter((c) => c.table === "ResourceAccess" && c.operation === "upsert")
    .flatMap((c) => c.args[0] as unknown[]);

describe("ensurePublishedRelationsAccuracy", () => {
  beforeEach(() => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
      [OTHER_IMPORTED_RID]: ["g1"],
    });
  });

  it("publishes a relation between a local and an imported node to their shared group", async () => {
    const calls = await runAccuracyCheck({
      relations: [relation("rel", "localG1", "imported")],
    });

    expect(upsertedRows(calls)).toEqual([
      { source_local_id: "rel", space_id: SPACE_ID, account_uid: "g1" },
    ]);
  });

  it("publishes a relation between two imported nodes to their shared group", async () => {
    const calls = await runAccuracyCheck({
      relations: [relation("rel", "imported", "otherImported")],
    });

    expect(upsertedRows(calls)).toEqual([
      { source_local_id: "rel", space_id: SPACE_ID, account_uid: "g1" },
    ]);
    expect(ensurePartialSpaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ groupIds: ["g1"], spaceId: SPACE_ID }),
    );
  });

  it("does not publish a relation to a group whose space access cannot be written", async () => {
    failSpaceAccess();

    const calls = await runAccuracyCheck({
      relations: [relation("rel", "imported", "otherImported")],
    });

    expect(upsertedRows(calls)).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("access to the space"),
      { g1: "partial" },
    );
  });

  it("still saves deleted grants when the space access lookup throws", async () => {
    vi.mocked(ensurePartialSpaceAccess).mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(saveRelations).mockClear();
    const stale = {
      ...relation("stale", "localG2", "imported"),
      publishedToGroupId: ["g1"],
    };

    const calls = await runAccuracyCheck({
      relations: [relation("rel", "localG1", "imported"), stale],
      grantedLocalIdsByGroup: { g1: ["stale"] },
    });

    expect(upsertedRows(calls)).toEqual([]);
    expect(stale.publishedToGroupId).toEqual([]);
    expect(saveRelations).toHaveBeenCalled();
  });

  it("does not publish a relation whose ends share no group", async () => {
    const calls = await runAccuracyCheck({
      relations: [relation("rel", "localG2", "imported")],
    });

    expect(upsertedRows(calls)).toEqual([]);
  });

  it("leaves existing grants alone when the shared check fails", async () => {
    vi.mocked(getPublishedGroupIdsByRid).mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const calls = await runAccuracyCheck({
      relations: [relation("rel", "localG1", "imported")],
      grantedLocalIdsByGroup: { g1: ["rel"] },
    });

    expect(
      calls.filter(
        (c) => c.table === "ResourceAccess" && c.operation !== "select",
      ),
    ).toEqual([]);
  });
});

const TRIPLE = {
  id: "claim-supports-claim",
  relationshipTypeId: "supports",
  sourceId: "claim",
  destinationId: "claim",
};

const pluginWithNodes = (
  nodes: Record<string, DiscourseNodeInVault>,
): DiscourseGraphPlugin => {
  const frontmatterById = Object.fromEntries(
    Object.values(nodes).map((n) => [
      n.nodeInstanceId,
      {
        nodeInstanceId: n.nodeInstanceId,
        nodeTypeId: "claim",
        ...n.frontmatter,
      },
    ]),
  );
  return {
    settings: { discourseRelations: [TRIPLE], relationTypes: [] },
    app: {
      metadataCache: {
        getFileCache: (file: TFile) => ({
          frontmatter: frontmatterById[file.basename],
        }),
      },
    },
  } as unknown as DiscourseGraphPlugin;
};

const grantRows = (group: string, relationId: string): unknown[] =>
  [relationId, "supports", TRIPLE.id].map((source_local_id) => ({
    account_uid: group,
    source_local_id,
    space_id: SPACE_ID,
  }));

describe("publishNewRelation", () => {
  const runPublish = async (
    newRelation: RelationInstance,
  ): Promise<{ published: boolean; calls: Call[] }> => {
    vi.mocked(getAvailableGroupIds).mockResolvedValue(["g1", "g2"]);
    vi.mocked(getFileForNodeInstanceId).mockImplementation(
      (_plugin, id) => allNodesById[id]?.file ?? null,
    );
    const fake = createFakeClient({
      syncedRelationIds: [],
      grantedLocalIdsByGroup: {},
    });
    vi.mocked(getLoggedInClient).mockResolvedValue(fake.client);
    vi.mocked(getSupabaseContext).mockResolvedValue({
      spaceId: SPACE_ID,
    } as SupabaseContext);
    const published = await publishNewRelation(
      pluginWithNodes(allNodesById),
      newRelation,
    );
    return { published, calls: fake.calls };
  };

  beforeEach(() => {
    vi.mocked(syncAllNodesAndRelations).mockReset();
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
      [OTHER_IMPORTED_RID]: ["g1"],
    });
  });

  it("publishes a new relation between a local and an imported node to their shared group", async () => {
    const newRelation = relation("rel", "localG1", "imported");

    const { published, calls } = await runPublish(newRelation);

    expect(published).toBe(true);
    expect(upsertedRows(calls)).toEqual(grantRows("g1", "rel"));
    expect(newRelation.publishedToGroupId).toEqual(["g1"]);
  });

  it("publishes a new relation between two imported nodes to their shared group", async () => {
    const { published, calls } = await runPublish(
      relation("rel", "imported", "otherImported"),
    );

    expect(published).toBe(true);
    expect(upsertedRows(calls)).toEqual(grantRows("g1", "rel"));
    expect(ensurePartialSpaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ groupIds: ["g1"], spaceId: SPACE_ID }),
    );
  });

  it("does not publish a new relation to a group whose space access cannot be written", async () => {
    failSpaceAccess();

    const { published, calls } = await runPublish(
      relation("rel", "imported", "otherImported"),
    );

    expect(published).toBe(false);
    expect(upsertedRows(calls)).toEqual([]);
  });

  it("does not publish a new relation whose ends share no group", async () => {
    const { published, calls } = await runPublish(
      relation("rel", "localG2", "imported"),
    );

    expect(published).toBe(false);
    expect(upsertedRows(calls)).toEqual([]);
    expect(syncAllNodesAndRelations).not.toHaveBeenCalled();
  });
});

describe("publishNodeRelations", () => {
  // `publishing` is being published to g1, so its frontmatter lacks g1.
  const runPublish = async (relations: RelationInstance[]): Promise<Call[]> => {
    vi.mocked(getRelationsForNodeInstanceId).mockResolvedValue(relations);
    vi.mocked(loadRelations).mockResolvedValue({
      version: 1,
      lastModified: 0,
      relations: Object.fromEntries(relations.map((r) => [r.id, r])),
    });
    const nodes: Record<string, DiscourseNodeInVault> = {
      ...allNodesById,
      publishing: node("publishing", { nodeTypeId: "claim" }),
    };
    vi.mocked(getFileForNodeInstanceIds).mockImplementation((_plugin, ids) =>
      Object.fromEntries(
        [...ids].flatMap((id) => {
          const n = nodes[id];
          return n ? [[id, n.file]] : [];
        }),
      ),
    );
    const plugin = pluginWithNodes(nodes);
    const fake = createFakeClient({
      syncedRelationIds: [],
      grantedLocalIdsByGroup: {},
    });
    await publishNodeRelations({
      plugin,
      client: fake.client,
      nodeId: "publishing",
      myGroup: "g1",
      spaceId: SPACE_ID,
    });
    return fake.calls;
  };

  beforeEach(() => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
      [OTHER_IMPORTED_RID]: ["g2"],
    });
  });

  it("publishes a relation to an imported node published to the group", async () => {
    const calls = await runPublish([relation("rel", "publishing", "imported")]);

    expect(upsertedRows(calls)).toEqual(grantRows("g1", "rel"));
  });

  it("does not publish a relation to an imported node published to another group", async () => {
    const calls = await runPublish([
      relation("rel", "publishing", "otherImported"),
    ]);

    expect(upsertedRows(calls)).toEqual([]);
  });

  it("does not publish a relation imported from another space", async () => {
    const calls = await runPublish([
      {
        ...relation("rel", "publishing", "imported"),
        importedFromRid: IMPORTED_RID,
      },
    ]);

    expect(upsertedRows(calls)).toEqual([]);
  });
});

describe("publishNodeToGroup", () => {
  const runPublishToGroup = async (
    failingWriteTables: string[] = [],
  ): Promise<{ result: Promise<void>; calls: Call[] }> => {
    const relations = [relation("rel", "publishing", "imported")];
    vi.mocked(getRelationsForNodeInstanceId).mockResolvedValue(relations);
    vi.mocked(loadRelations).mockResolvedValue({
      version: 1,
      lastModified: 0,
      relations: Object.fromEntries(relations.map((r) => [r.id, r])),
    });
    const nodes: Record<string, DiscourseNodeInVault> = {
      ...allNodesById,
      publishing: node("publishing", {}),
    };
    vi.mocked(getFileForNodeInstanceIds).mockImplementation((_plugin, ids) =>
      Object.fromEntries(
        [...ids].flatMap((id) => {
          const n = nodes[id];
          return n ? [[id, n.file]] : [];
        }),
      ),
    );
    vi.mocked(findEmbeddedAttachments).mockReturnValue([]);
    const fake = createFakeClient({
      syncedRelationIds: [],
      grantedLocalIdsByGroup: {},
      failingWriteTables,
    });
    vi.mocked(getLoggedInClient).mockResolvedValue(fake.client);
    vi.mocked(getSupabaseContext).mockResolvedValue({
      spaceId: SPACE_ID,
    } as SupabaseContext);
    const result = publishNodeToGroup({
      plugin: pluginWithNodes(nodes),
      file: { stat: { mtime: 0 } } as unknown as TFile,
      frontmatter: { nodeInstanceId: "publishing" },
      myGroup: "g1",
      skipFrontmatterUpdate: true,
    });
    await result.catch(() => {});
    return { result, calls: fake.calls };
  };

  // The node's own grant is a single row; relation grants are an array.
  const isRelationGrant = (c: Call): boolean =>
    c.table === "ResourceAccess" &&
    c.operation === "upsert" &&
    Array.isArray(c.args[0]);

  beforeEach(() => {
    vi.mocked(getPublishedGroupIdsByRid).mockResolvedValue({
      [IMPORTED_RID]: ["g1"],
    });
  });

  it("publishes the node's relations after its space access", async () => {
    const { result, calls } = await runPublishToGroup();

    await expect(result).resolves.toBeUndefined();
    const spaceAccessIndex = calls.findIndex(
      (c) => c.table === "SpaceAccess" && c.operation === "upsert",
    );
    const relationGrantIndex = calls.findIndex(isRelationGrant);
    expect(spaceAccessIndex).toBeGreaterThanOrEqual(0);
    expect(relationGrantIndex).toBeGreaterThan(spaceAccessIndex);
  });

  it("does not publish the node's relations when its space access cannot be written", async () => {
    const { result, calls } = await runPublishToGroup(["SpaceAccess"]);

    await expect(result).rejects.toMatchObject({ code: "42501" });
    expect(calls.filter(isRelationGrant)).toEqual([]);
  });
});
