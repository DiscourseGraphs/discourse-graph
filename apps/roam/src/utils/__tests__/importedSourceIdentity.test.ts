import { beforeEach, describe, expect, it, vi } from "vitest";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import {
  findImportedNodeUidBySourceRid,
  getImportedSourceRids,
  IMPORTED_FROM_PROP_KEY,
  parseImportedSourceIdentity,
  readImportedSourceIdentity,
  writeImportedSourceIdentity,
} from "~/utils/importedSourceIdentity";
import type { json } from "~/utils/getBlockProps";

const SOURCE_NODE_RID = "orn:obsidian.note:vault-a/node-1";
const SOURCE_MODIFIED_AT = "2026-06-14T15:00:00.000Z";
const PAGE_UID = "page-uid";

const propsByUid = new Map<string, Record<string, json>>();
const query = vi.fn();

const setRoamAlphaApi = (): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        async: { q: query },
        block: {
          update: vi.fn(
            ({
              block,
            }: {
              block: { props: Record<string, json>; uid: string };
            }) => {
              propsByUid.set(block.uid, block.props);
            },
          ),
        },
      },
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": propsByUid.get(uid) ?? {},
      }),
    },
  };
};

beforeEach(() => {
  propsByUid.clear();
  query.mockReset();
  setRoamAlphaApi();
});

describe("imported source identity metadata", () => {
  it("reads the source RID without depending on display metadata", () => {
    const props = {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        [IMPORTED_FROM_PROP_KEY]: {
          sourceModifiedAt: SOURCE_MODIFIED_AT,
          sourceNodeRid: SOURCE_NODE_RID,
          sourceTitle: "Legacy title that may change",
        },
      },
    };

    expect(parseImportedSourceIdentity(props)).toEqual({
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
  });

  it("returns undefined for missing or malformed source identity", () => {
    expect(parseImportedSourceIdentity({})).toBeUndefined();
    expect(
      parseImportedSourceIdentity({
        [DISCOURSE_GRAPH_PROP_NAME]: {
          [IMPORTED_FROM_PROP_KEY]: { sourceNodeRid: 123 },
        },
      }),
    ).toBeUndefined();
  });

  it("writes the source RID and modified time while preserving sibling metadata", () => {
    propsByUid.set(PAGE_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        "relation-migration": { relationUid: 1718000000000 },
      },
      "other-extension": { enabled: true },
    });

    writeImportedSourceIdentity({
      pageUid: PAGE_UID,
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });

    expect(readImportedSourceIdentity(PAGE_UID)).toEqual({
      sourceModifiedAt: SOURCE_MODIFIED_AT,
      sourceNodeRid: SOURCE_NODE_RID,
    });
    expect(propsByUid.get(PAGE_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: {
        "relation-migration": { relationUid: 1718000000000 },
        [IMPORTED_FROM_PROP_KEY]: {
          sourceModifiedAt: SOURCE_MODIFIED_AT,
          sourceNodeRid: SOURCE_NODE_RID,
        },
      },
      "other-extension": { enabled: true },
    });
  });
});

describe("imported source identity lookup", () => {
  it("returns the stored RID set used for duplicate prevention", async () => {
    query.mockResolvedValue([SOURCE_NODE_RID, 123, null]);

    await expect(getImportedSourceRids()).resolves.toEqual(
      new Set([SOURCE_NODE_RID]),
    );
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain(":sourceNodeRid");
  });

  it("finds the imported Roam page by source RID", async () => {
    query.mockResolvedValue([[PAGE_UID]]);

    await expect(findImportedNodeUidBySourceRid(SOURCE_NODE_RID)).resolves.toBe(
      PAGE_UID,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(":sourceNodeRid"),
      SOURCE_NODE_RID,
    );
  });

  it("returns null when the source RID has not been imported", async () => {
    query.mockResolvedValue([]);

    await expect(
      findImportedNodeUidBySourceRid(SOURCE_NODE_RID),
    ).resolves.toBeNull();
  });
});
