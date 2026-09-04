import { beforeEach, describe, expect, it, vi } from "vitest";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import { IMPORTED_FROM_PROP_KEY } from "~/utils/importedSourceIdentity";
import {
  acceptImportedRelationSchema,
  excludeProvisionalRelationSchemas,
  isProvisionalRelationSchema,
  readRelationSchemaImportMeta,
  RELATION_SCHEMA_STATUS_PROP_KEY,
} from "~/utils/relationSchemaAcceptance";
import type { json } from "~/utils/getBlockProps";

const SOURCE_NODE_RID = "orn:obsidian.schema:vault-a/relation-type-1";
const SOURCE_MODIFIED_AT = "2026-08-01T12:00:00.000Z";
const SCHEMA_UID = "relation-schema-uid";

const importedFromProps = {
  [IMPORTED_FROM_PROP_KEY]: {
    sourceModifiedAt: SOURCE_MODIFIED_AT,
    sourceNodeRid: SOURCE_NODE_RID,
  },
};

const propsByUid = new Map<string, Record<string, json>>();

const setRoamAlphaApi = (): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        block: {
          update: vi.fn(
            ({
              block,
            }: {
              block: { props: Record<string, json>; uid: string };
            }) => {
              propsByUid.set(block.uid, block.props);
              return Promise.resolve();
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
  setRoamAlphaApi();
});

describe("relation schema import meta", () => {
  it("returns undefined for local schemas without imported provenance", () => {
    expect(readRelationSchemaImportMeta(SCHEMA_UID)).toBeUndefined();
    expect(isProvisionalRelationSchema(SCHEMA_UID)).toBe(false);
  });

  it("treats imported schemas without a status as provisional", () => {
    propsByUid.set(SCHEMA_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: importedFromProps,
    });

    expect(readRelationSchemaImportMeta(SCHEMA_UID)).toEqual({
      importedFrom: {
        sourceModifiedAt: SOURCE_MODIFIED_AT,
        sourceNodeRid: SOURCE_NODE_RID,
      },
      status: "provisional",
    });
    expect(isProvisionalRelationSchema(SCHEMA_UID)).toBe(true);
  });

  it("treats imported schemas with an accepted status as accepted", () => {
    propsByUid.set(SCHEMA_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        ...importedFromProps,
        [RELATION_SCHEMA_STATUS_PROP_KEY]: "accepted",
      },
    });

    expect(readRelationSchemaImportMeta(SCHEMA_UID)?.status).toBe("accepted");
    expect(isProvisionalRelationSchema(SCHEMA_UID)).toBe(false);
  });
});

describe("acceptImportedRelationSchema", () => {
  it("marks the schema accepted while preserving imported provenance", async () => {
    propsByUid.set(SCHEMA_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: importedFromProps,
      "other-extension": { enabled: true },
    });

    await acceptImportedRelationSchema(SCHEMA_UID);

    expect(propsByUid.get(SCHEMA_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: {
        ...importedFromProps,
        [RELATION_SCHEMA_STATUS_PROP_KEY]: "accepted",
      },
      "other-extension": { enabled: true },
    });
    expect(readRelationSchemaImportMeta(SCHEMA_UID)?.status).toBe("accepted");
  });
});

describe("excludeProvisionalRelationSchemas", () => {
  it("filters provisional schemas but keeps local and accepted ones", () => {
    propsByUid.set("provisional-uid", {
      [DISCOURSE_GRAPH_PROP_NAME]: importedFromProps,
    });
    propsByUid.set("accepted-uid", {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        ...importedFromProps,
        [RELATION_SCHEMA_STATUS_PROP_KEY]: "accepted",
      },
    });

    const relations = [
      { id: "local-uid" },
      { id: "provisional-uid" },
      { id: "accepted-uid" },
    ];

    expect(excludeProvisionalRelationSchemas(relations)).toEqual([
      { id: "local-uid" },
      { id: "accepted-uid" },
    ]);
  });
});
