import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type { DiscourseNode, RelationInstance } from "~/types";
import type { DiscourseNodeInVault } from "~/utils/getDiscourseNodes";
import {
  filterAvailableSourceSlotValues,
  indexSourceSlotValues,
} from "~/utils/sourceSlot";

type LookupResult = { data: number | null; error: Error | null };

const SOURCE_RID = spaceUriAndLocalIdToRid(
  "https://roamresearch.com/#/app/research",
  "source",
  "note",
);

const LOCAL_URI = "obsidian:local-vault";

const NODE_TYPES_BY_ID: Record<string, DiscourseNode> = {
  "evidence-type": {
    id: "evidence-type",
    name: "Evidence",
    format: "EVD - {content}",
    created: 0,
    modified: 0,
  },
  "source-type": {
    id: "source-type",
    name: "Source",
    format: "SRC - {content}",
    created: 0,
    modified: 0,
  },
};

const vaultNode = ({
  nodeInstanceId,
  nodeTypeId,
  importedFromRid,
}: {
  nodeInstanceId: string;
  nodeTypeId: string;
  importedFromRid?: string;
}): DiscourseNodeInVault => ({
  file: {} as TFile,
  frontmatter: importedFromRid ? { importedFromRid } : {},
  nodeTypeId,
  nodeInstanceId,
});

const EVIDENCE = vaultNode({
  nodeInstanceId: "evidence",
  nodeTypeId: "evidence-type",
});

const sourceRelation = ({
  id,
  destination,
  created,
}: {
  id: string;
  destination: string;
  created: number;
}): RelationInstance => ({
  id,
  type: "based-on",
  source: "evidence",
  destination,
  created,
});

const clientWith = (
  rpc: (name: string, args: { rid: string }) => Promise<LookupResult>,
): DGSupabaseClient => ({ rpc }) as unknown as DGSupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("indexSourceSlotValues", () => {
  it("selects the earliest Source relation by created date, regardless of array order", () => {
    expect(
      indexSourceSlotValues({
        relations: [
          sourceRelation({ id: "later", destination: "newer", created: 20 }),
          sourceRelation({ id: "earliest", destination: "source", created: 1 }),
        ],
        nodes: [
          EVIDENCE,
          vaultNode({ nodeInstanceId: "source", nodeTypeId: "source-type" }),
          vaultNode({ nodeInstanceId: "newer", nodeTypeId: "source-type" }),
        ],
        localSpaceUri: LOCAL_URI,
        nodeTypesById: NODE_TYPES_BY_ID,
      }),
    ).toEqual({ evidence: "source" });
  });

  it.each([
    ["its id", "imported-source"],
    [
      "this vault's RID",
      spaceUriAndLocalIdToRid(LOCAL_URI, "imported-source", "note"),
    ],
    ["its origin RID", SOURCE_RID],
  ])(
    "uses the origin RID of an imported Source stored by %s",
    (_endpoint, destination) => {
      expect(
        indexSourceSlotValues({
          relations: [
            sourceRelation({
              id: "imported",
              destination,
              created: 1,
            }),
          ],
          nodes: [
            EVIDENCE,
            vaultNode({
              nodeInstanceId: "imported-source",
              nodeTypeId: "source-type",
              importedFromRid: SOURCE_RID,
            }),
          ],
          localSpaceUri: LOCAL_URI,
          nodeTypesById: NODE_TYPES_BY_ID,
        }),
      ).toEqual({ evidence: SOURCE_RID });
    },
  );
});

describe("filterAvailableSourceSlotValues", () => {
  it("keeps results attached to their Sources when parallel lookups finish out of order", async () => {
    const responses = new Map<string, (result: LookupResult) => void>();
    const rpc = vi.fn(
      (_name: string, { rid }: { rid: string }) =>
        new Promise<LookupResult>((resolve) => responses.set(rid, resolve)),
    );
    const result = filterAvailableSourceSlotValues({
      sourceSlotByNodeId: {
        first: "available-source",
        second: "missing-source",
      },
      client: clientWith(rpc),
      spaceId: 42,
      pendingNodeIds: new Set(),
    });
    const respond = (rid: string, lookup: LookupResult): void => {
      const resolve = responses.get(rid);
      if (!resolve) throw new Error(`No lookup started for ${rid}`);
      resolve(lookup);
    };
    expect(rpc).toHaveBeenCalledTimes(2);
    respond("missing-source", { data: null, error: null });
    respond("available-source", { data: 21, error: null });
    expect(await result).toEqual({ first: "available-source" });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Source missing-source is not in the database yet; pushing node second without sourceDocument",
    );
  });

  it("resolves each distinct source once and preserves explicitly selected local sources", async () => {
    const rpc = vi.fn((_name: string, { rid }: { rid: string }) =>
      Promise.resolve({ data: rid === SOURCE_RID ? 21 : null, error: null }),
    );
    const values = await filterAvailableSourceSlotValues({
      sourceSlotByNodeId: {
        first: SOURCE_RID,
        second: SOURCE_RID,
        third: "new-source",
        fourth: "missing",
      },
      client: clientWith(rpc),
      spaceId: 42,
      pendingNodeIds: new Set(["new-source"]),
    });
    expect(values).toEqual({
      first: SOURCE_RID,
      second: SOURCE_RID,
      third: "new-source",
    });
    expect(rpc.mock.calls).toEqual([
      [
        "rid_or_local_id_to_concept_db_id",
        { rid: SOURCE_RID, default_space_id: 42 },
      ],
      [
        "rid_or_local_id_to_concept_db_id",
        { rid: "missing", default_space_id: 42 },
      ],
    ]);
  });

  it("drops an unavailable earliest Source instead of falling back to a later available one", async () => {
    const sourceSlotByNodeId = indexSourceSlotValues({
      relations: [
        sourceRelation({ id: "earliest", destination: SOURCE_RID, created: 1 }),
        sourceRelation({ id: "later", destination: "later", created: 20 }),
      ],
      nodes: [
        EVIDENCE,
        vaultNode({
          nodeInstanceId: "imported-source",
          nodeTypeId: "source-type",
          importedFromRid: SOURCE_RID,
        }),
        vaultNode({ nodeInstanceId: "later", nodeTypeId: "source-type" }),
      ],
      localSpaceUri: LOCAL_URI,
      nodeTypesById: NODE_TYPES_BY_ID,
    });
    const rpc = vi.fn((_name: string, { rid }: { rid: string }) =>
      Promise.resolve({ data: rid === "later" ? 21 : null, error: null }),
    );
    expect(
      await filterAvailableSourceSlotValues({
        sourceSlotByNodeId,
        client: clientWith(rpc),
        spaceId: 42,
        pendingNodeIds: new Set(),
      }),
    ).toEqual({});
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      `Source ${SOURCE_RID} is not in the database yet; pushing node evidence without sourceDocument`,
    );
  });

  it("does not mistake a lookup failure for an absent Source", async () => {
    const error = new Error("lookup failed");
    await expect(
      filterAvailableSourceSlotValues({
        sourceSlotByNodeId: { evidence: "source" },
        client: clientWith(() => Promise.resolve({ data: null, error })),
        spaceId: 1,
        pendingNodeIds: new Set(),
      }),
    ).rejects.toBe(error);
  });

  it("does not query when no node has a source", async () => {
    const rpc = vi.fn();
    expect(
      await filterAvailableSourceSlotValues({
        sourceSlotByNodeId: {},
        client: clientWith(rpc),
        spaceId: 1,
        pendingNodeIds: new Set(),
      }),
    ).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
  });
});
