import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOURSE_GRAPH_PROP_NAME,
  createReifiedRelation,
  strictQueryForReifiedBlocks,
} from "~/utils/createReifiedBlock";
import {
  acceptTentativeRelationInstance,
  getTentativeRelationInstances,
} from "~/utils/tentativeRelations";
import type { json } from "~/utils/getBlockProps";

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: () => "relations-page",
}));

const RELATION_UID = "rel-block-1";
const SOURCE_NODE_RID = "orn:obsidian.note:vault-a/relation-1";
const SOURCE_MODIFIED_AT = "2026-08-21T15:00:00.000Z";

const propsByUid = new Map<string, Record<string, json>>();
const query = vi.fn();
const update = vi.fn(
  ({ block }: { block: { props: Record<string, json>; uid: string } }) => {
    propsByUid.set(block.uid, block.props);
    return Promise.resolve();
  },
);

const setRoamAlphaApi = (): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        async: { q: query },
        block: { update },
      },
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": propsByUid.get(uid) ?? {},
      }),
    },
  };
};

const tentativeRelationProps = (): Record<string, json> => ({
  sourceUid: "claim-a",
  destinationUid: "question-a",
  hasSchema: "supports",
  tentative: "true",
  importedFrom: {
    sourceModifiedAt: SOURCE_MODIFIED_AT,
    sourceNodeRid: SOURCE_NODE_RID,
  },
});

const acceptedRelationProps = (): Record<string, json> => ({
  sourceUid: "claim-a",
  destinationUid: "question-a",
  hasSchema: "supports",
  importedFrom: {
    sourceModifiedAt: SOURCE_MODIFIED_AT,
    sourceNodeRid: SOURCE_NODE_RID,
  },
});

beforeEach(() => {
  propsByUid.clear();
  query.mockReset();
  update.mockClear();
  setRoamAlphaApi();
});

describe("getTentativeRelationInstances", () => {
  it("returns only tentative relations with their source identity", async () => {
    query.mockResolvedValue([
      [RELATION_UID, tentativeRelationProps()],
      [
        "rel-block-2",
        {
          sourceUid: "evidence-a",
          destinationUid: "claim-a",
          hasSchema: "informs",
        },
      ],
    ]);

    expect(await getTentativeRelationInstances()).toEqual([
      {
        instanceUid: RELATION_UID,
        schemaUid: "supports",
        sourceUid: "claim-a",
        destinationUid: "question-a",
        importedFrom: {
          sourceModifiedAt: SOURCE_MODIFIED_AT,
          sourceNodeRid: SOURCE_NODE_RID,
        },
      },
    ]);
  });
});

describe("acceptTentativeRelationInstance", () => {
  it("removes the tentative flag while preserving identity and provenance", async () => {
    propsByUid.set(RELATION_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: tentativeRelationProps(),
    });

    await acceptTentativeRelationInstance({ instanceUid: RELATION_UID });

    expect(propsByUid.get(RELATION_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: acceptedRelationProps(),
    });
  });

  it("is a no-op for a relation that is already accepted", async () => {
    propsByUid.set(RELATION_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: acceptedRelationProps(),
    });

    await acceptTentativeRelationInstance({ instanceUid: RELATION_UID });

    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the relation block cannot be read", async () => {
    await expect(
      acceptTentativeRelationInstance({ instanceUid: "missing" }),
    ).rejects.toThrow(/could not be read/);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("createReifiedRelation", () => {
  it("promotes a matching tentative import instead of returning it hidden", async () => {
    query.mockResolvedValue([[RELATION_UID, tentativeRelationProps()]]);
    propsByUid.set(RELATION_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: tentativeRelationProps(),
    });

    const uid = await createReifiedRelation({
      sourceUid: "claim-a",
      destinationUid: "question-a",
      relationBlockUid: "supports",
    });

    expect(uid).toBe(RELATION_UID);
    expect(propsByUid.get(RELATION_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: acceptedRelationProps(),
    });
  });

  it("leaves a matching tentative import untouched during re-import", async () => {
    query.mockResolvedValue([[RELATION_UID, tentativeRelationProps()]]);
    propsByUid.set(RELATION_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: tentativeRelationProps(),
    });

    const uid = await createReifiedRelation({
      sourceUid: "claim-a",
      destinationUid: "question-a",
      relationBlockUid: "supports",
      tentative: true,
    });

    expect(uid).toBe(RELATION_UID);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("strictQueryForReifiedBlocks", () => {
  it("matches imported relation blocks despite annotation keys", async () => {
    query.mockResolvedValue([[RELATION_UID, tentativeRelationProps()]]);

    expect(
      await strictQueryForReifiedBlocks({
        sourceUid: "claim-a",
        destinationUid: "question-a",
        hasSchema: "supports",
      }),
    ).toBe(RELATION_UID);
  });

  it("still rejects blocks with extra role keys", async () => {
    query.mockResolvedValue([
      [RELATION_UID, { ...tentativeRelationProps(), contextUid: "context-a" }],
    ]);

    expect(
      await strictQueryForReifiedBlocks({
        sourceUid: "claim-a",
        destinationUid: "question-a",
        hasSchema: "supports",
      }),
    ).toBeNull();
  });
});
