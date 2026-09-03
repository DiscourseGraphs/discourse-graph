import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { contentTypes } from "@repo/content-model";

const mocks = vi.hoisted(() => ({
  getDiscourseNodes: vi.fn(),
  getAvailableGroupIds: vi.fn(),
  ensurePartialSpaceAccess: vi.fn(),
  internalError: vi.fn(),
}));

vi.mock("~/utils/getDiscourseNodes", () => ({
  default: mocks.getDiscourseNodes,
}));

vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => [],
}));

vi.mock("~/utils/createReifiedBlock", () => ({
  getReifiedRelations: () => Promise.resolve([]),
}));

vi.mock("~/utils/internalError", () => ({
  default: mocks.internalError,
}));

vi.mock("~/utils/importedSourceIdentity", () => ({
  readImportedSourceIdentity: () => undefined,
}));

vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: (uid: string) => (uid === SOURCE_UID ? SOURCE_TITLE : ""),
}));

vi.mock("~/utils/roamToCrossAppConverters", () => ({
  nodeUidsWithTypeToCrossApp: vi.fn(),
  nodeSchemaToCrossApp: (s: DiscourseNode) => ({
    localId: s.type,
    label: s.text,
    authorId: "author-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    format: s.format,
  }),
  reifiedRelationToCrossApp: vi.fn(),
  relationTripleSchemaToCrossApp: vi.fn(),
}));

vi.mock("@repo/database/lib/groups", () => ({
  getAvailableGroupIds: mocks.getAvailableGroupIds,
  ensurePartialSpaceAccess: mocks.ensurePartialSpaceAccess,
}));

vi.mock("@repo/database/lib/contextFunctions", () => ({
  isIgnorableUpsertError: (error: { code?: string } | null) =>
    !error || error.code === "23505",
}));

import { publishNodesToGroups } from "~/utils/publishNodesToGroups";

const SPACE_ID = 42;
const GROUP_ID = "group-1";
const SCHEMA_UID = "schema-1";
const SOURCE_UID = "source-1";
const SOURCE_TITLE = "@sun2019direct";
const SOURCE_RID = "orn:obsidian.note:vault-a/node-1";

const claimSchema: DiscourseNode = {
  type: SCHEMA_UID,
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "[[CLM]] - {content}",
};

const makeCrossAppNode = ({
  uid,
  title,
  coreTitle = title,
  slots,
}: {
  uid: string;
  title: string;
  coreTitle?: string;
  slots?: CrossAppNode["slots"];
}): CrossAppNode => ({
  localId: uid,
  nodeType: SCHEMA_UID,
  coreTitle,
  authorId: "user-1",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  modifiedAt: new Date("2026-01-03T00:00:00.000Z"),
  content: {
    direct: { localId: uid, value: title },
    full: {
      localId: uid,
      value: `# ${title}\n\nBody\n`,
      contentType: contentTypes.roamMarkdown,
      scale: "document",
    },
  },
  ...(slots ? { slots } : {}),
});

type RpcArgs = { v_space_id: number; data: Record<string, unknown>[] };

const makeFakeClient = ({
  syncedUids = [],
  rpcResponse,
}: {
  syncedUids?: string[];
  rpcResponse?: { data: number[] | null; error: { message: string } | null };
}) => {
  const rpcCalls: { fn: string; args: RpcArgs }[] = [];
  const conceptLookups: string[][] = [];
  const upsertCalls: {
    table: string;
    rows: Record<string, unknown>[];
    options: Record<string, unknown>;
  }[] = [];
  const selectResult = (table: string) =>
    Promise.resolve({
      data:
        table === "my_concepts"
          ? syncedUids.map((uid) => ({ source_local_id: uid }))
          : [],
      error: null,
    });
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          in: (_column: string, values: string[]) => {
            if (table === "my_concepts") conceptLookups.push(values);
            return selectResult(table);
          },
        }),
        in: () => selectResult(table),
      }),
      upsert: (
        rows: Record<string, unknown>[],
        options: Record<string, unknown>,
      ) => {
        upsertCalls.push({ table, rows, options });
        return Promise.resolve({ error: null });
      },
    }),
    rpc: (fn: string, args: RpcArgs) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(
        rpcResponse ?? { data: args.data.map((_, i) => i + 1), error: null },
      );
    },
  } as unknown as DGSupabaseClient;
  return { client, rpcCalls, conceptLookups, upsertCalls };
};

describe("publishNodesToGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDiscourseNodes.mockReturnValue([claimSchema]);
    mocks.getAvailableGroupIds.mockResolvedValue([GROUP_ID]);
    mocks.ensurePartialSpaceAccess.mockImplementation(
      ({ groupIds }: { groupIds: string[] }) =>
        Promise.resolve({
          existing: Object.fromEntries(groupIds.map((g) => [g, "partial"])),
          missing: {},
        }),
    );
  });

  it("upserts the schema and the complete node concept before granting access to a new node", async () => {
    const { client, rpcCalls, upsertCalls } = makeFakeClient({});

    const result = await publishNodesToGroups({
      client,
      spaceId: SPACE_ID,
      groupIds: [GROUP_ID],
      nodes: [
        makeCrossAppNode({
          uid: "node-1",
          title: "CLM - new claim",
          coreTitle: "new claim",
        }),
      ],
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("upsert_concepts");
    const { v_space_id: rpcSpaceId, data } = rpcCalls[0].args;
    expect(rpcSpaceId).toBe(SPACE_ID);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      source_local_id: SCHEMA_UID,
      is_schema: true,
      name: "Claim",
      literal_content: { format: "[[CLM]] - {content}" },
    });
    expect(data[1]).toMatchObject({
      source_local_id: "node-1",
      name: "CLM - new claim",
      schema_represented_by_local_id: SCHEMA_UID,
      literal_content: { core_title: "new claim" },
    });
    expect(data[1].contents_inline).toEqual([
      expect.objectContaining({
        source_local_id: "node-1",
        variant: "direct",
        text: "CLM - new claim",
      }),
      expect.objectContaining({
        source_local_id: "node-1",
        variant: "full",
        text: "# CLM - new claim\n\nBody\n",
        content_type: contentTypes.roamMarkdown,
      }),
    ]);

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].table).toBe("ResourceAccess");
    expect(upsertCalls[0].options).toEqual({ ignoreDuplicates: true });
    expect(upsertCalls[0].rows).toEqual(
      expect.arrayContaining([
        {
          account_uid: GROUP_ID,
          source_local_id: "node-1",
          space_id: SPACE_ID,
        },
        {
          account_uid: GROUP_ID,
          source_local_id: SCHEMA_UID,
          space_id: SPACE_ID,
        },
      ]),
    );
    expect(result.publishedNodeUids).toEqual(["node-1"]);
    expect(result.publishedNodeSchemaUids).toEqual([SCHEMA_UID]);
    expect(result.syncedNodeSchemaUids).toEqual([SCHEMA_UID]);
    expect(result.okGroupIds).toEqual([GROUP_ID]);
    expect(result.failedUpsertUids).toEqual([]);
  });

  it("still upserts title and full content when republishing an already-synced node", async () => {
    const { client, rpcCalls } = makeFakeClient({ syncedUids: [SCHEMA_UID] });

    const result = await publishNodesToGroups({
      client,
      spaceId: SPACE_ID,
      groupIds: [GROUP_ID],
      nodes: [
        makeCrossAppNode({ uid: "node-1", title: "CLM - updated title" }),
      ],
    });

    const { data } = rpcCalls[0].args;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ source_local_id: "node-1" });
    expect(data[0].contents_inline).toEqual([
      expect.objectContaining({
        variant: "direct",
        text: "CLM - updated title",
      }),
      expect.objectContaining({
        variant: "full",
        text: "# CLM - updated title\n\nBody\n",
      }),
    ]);
    expect(result.syncedNodeSchemaUids).toEqual([]);
    expect(result.publishedNodeUids).toEqual(["node-1"]);
    expect(result.okGroupIds).toEqual([GROUP_ID]);
  });

  it("grants no access at all when the concept upsert request fails", async () => {
    const { client, upsertCalls } = makeFakeClient({
      rpcResponse: { data: null, error: { message: "boom" } },
    });

    const result = await publishNodesToGroups({
      client,
      spaceId: SPACE_ID,
      groupIds: [GROUP_ID],
      nodes: [makeCrossAppNode({ uid: "node-1", title: "CLM - new claim" })],
    });

    expect(upsertCalls).toHaveLength(0);
    expect(result.publishedNodeUids).toEqual([]);
    expect(result.okGroupIds).toEqual([]);
  });

  it.each([
    { code: -1, label: "unique-violation" },
    { code: -2, label: "generic-error" },
  ])(
    "withholds grants for nodes whose upsert failed with $label",
    async ({ code }) => {
      const { client, upsertCalls } = makeFakeClient({
        syncedUids: [SCHEMA_UID],
        rpcResponse: { data: [7, code], error: null },
      });

      const result = await publishNodesToGroups({
        client,
        spaceId: SPACE_ID,
        groupIds: [GROUP_ID],
        nodes: [
          makeCrossAppNode({ uid: "node-1", title: "CLM - publishes" }),
          makeCrossAppNode({ uid: "node-2", title: "CLM - fails" }),
        ],
      });

      expect(result.failedUpsertUids).toEqual(["node-2"]);
      expect(result.publishedNodeUids).toEqual(["node-1"]);
      const grantedIds = upsertCalls[0].rows.map((r) => r.source_local_id);
      expect(grantedIds).toContain("node-1");
      expect(grantedIds).toContain(SCHEMA_UID);
      expect(grantedIds).not.toContain("node-2");
    },
  );

  it("withholds dependent nodes when their schema upsert fails", async () => {
    const { client, upsertCalls } = makeFakeClient({
      rpcResponse: { data: [-1, 2, 3], error: null },
    });

    const result = await publishNodesToGroups({
      client,
      spaceId: SPACE_ID,
      groupIds: [GROUP_ID],
      nodes: [
        makeCrossAppNode({ uid: "node-1", title: "CLM - first" }),
        makeCrossAppNode({ uid: "node-2", title: "CLM - second" }),
      ],
    });

    expect(result.failedUpsertUids).toEqual([SCHEMA_UID, "node-1", "node-2"]);
    expect(result.publishedNodeUids).toEqual([]);
    expect(result.publishedNodeSchemaUids).toEqual([]);
    expect(upsertCalls[0].rows).toEqual([]);
  });

  describe("source slot", () => {
    const evidenceNode = (sourceId: string) =>
      makeCrossAppNode({
        uid: "node-1",
        title: `[[EVD]] - finding - [[${SOURCE_TITLE}]]`,
        slots: { sourceDocument: sourceId },
      });
    const publish = (
      client: DGSupabaseClient,
      nodes: CrossAppNode[] = [evidenceNode(SOURCE_UID)],
    ) =>
      publishNodesToGroups({
        client,
        spaceId: SPACE_ID,
        groupIds: [GROUP_ID],
        nodes,
      });

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("keeps the source slot when the source is already a concept in the space", async () => {
      const { client, rpcCalls, conceptLookups } = makeFakeClient({
        syncedUids: [SCHEMA_UID, SOURCE_UID],
      });

      await publish(client);

      expect(conceptLookups[0]).toContain(SOURCE_UID);
      expect(rpcCalls[0].args.data).toHaveLength(1);
      expect(rpcCalls[0].args.data[0]).toMatchObject({
        source_local_id: "node-1",
        local_reference_content: { sourceDocument: SOURCE_UID },
      });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("looks a source up once however many nodes reference it", async () => {
      const { client, conceptLookups } = makeFakeClient({
        syncedUids: [SCHEMA_UID, SOURCE_UID],
      });

      await publish(client, [
        evidenceNode(SOURCE_UID),
        makeCrossAppNode({
          uid: "node-2",
          title: `[[EVD]] - another finding - [[${SOURCE_TITLE}]]`,
          slots: { sourceDocument: SOURCE_UID },
        }),
      ]);

      expect(conceptLookups[0].filter((id) => id === SOURCE_UID)).toHaveLength(
        1,
      );
    });

    it("omits the source slot and warns when the source is not a concept in the space", async () => {
      const { client, rpcCalls, upsertCalls } = makeFakeClient({
        syncedUids: [SCHEMA_UID],
      });

      const result = await publish(client);

      expect(rpcCalls[0].args.data).toHaveLength(1);
      expect(rpcCalls[0].args.data[0]).toMatchObject({
        source_local_id: "node-1",
      });
      expect(rpcCalls[0].args.data[0].local_reference_content).toBeUndefined();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(`"${SOURCE_TITLE}" (${SOURCE_UID})`),
      );
      expect(result.publishedNodeUids).toEqual(["node-1"]);
      expect(result.failedUpsertUids).toEqual([]);
      expect(upsertCalls[0].rows.map((r) => r.source_local_id)).toContain(
        "node-1",
      );
    });

    it("upserts a source published in the same batch before the node referencing it", async () => {
      const { client, rpcCalls } = makeFakeClient({
        syncedUids: [SCHEMA_UID],
      });

      await publish(client, [
        evidenceNode(SOURCE_UID),
        makeCrossAppNode({ uid: SOURCE_UID, title: SOURCE_TITLE }),
      ]);

      const { data } = rpcCalls[0].args;
      expect(data.map((row) => row.source_local_id)).toEqual([
        SOURCE_UID,
        "node-1",
      ]);
      expect(data[1].local_reference_content).toEqual({
        sourceDocument: SOURCE_UID,
      });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("passes an imported source's RID through without looking it up in the space", async () => {
      const { client, rpcCalls, conceptLookups } = makeFakeClient({
        syncedUids: [SCHEMA_UID],
      });

      await publish(client, [evidenceNode(SOURCE_RID)]);

      expect(conceptLookups[0]).not.toContain(SOURCE_RID);
      expect(rpcCalls[0].args.data[0].local_reference_content).toEqual({
        sourceDocument: SOURCE_RID,
      });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("writes the same sourceDocument value on repeated publishes", async () => {
      const { client, rpcCalls } = makeFakeClient({
        syncedUids: [SCHEMA_UID, SOURCE_UID],
      });

      await publish(client);
      await publish(client);

      expect(rpcCalls).toHaveLength(2);
      expect(rpcCalls[1].args.data[0].local_reference_content).toEqual({
        sourceDocument: SOURCE_UID,
      });
      expect(rpcCalls[1].args.data[0].local_reference_content).toEqual(
        rpcCalls[0].args.data[0].local_reference_content,
      );
    });
  });
});
