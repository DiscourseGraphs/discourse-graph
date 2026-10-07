import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { filterAvailableSourceSlotValues } from "~/utils/sourceSlot";

type LookupResult = { data: number | null; error: Error | null };

const SOURCE_RID = spaceUriAndLocalIdToRid(
  "https://roamresearch.com/#/app/research",
  "source",
  "note",
);

const clientWith = (
  rpc: (name: string, args: { rid: string }) => Promise<LookupResult>,
): DGSupabaseClient => ({ rpc }) as unknown as DGSupabaseClient;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
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
    expect(rpc).toHaveBeenCalledTimes(2);
    responses.get("missing-source")?.({ data: null, error: null });
    responses.get("available-source")?.({ data: 21, error: null });
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
