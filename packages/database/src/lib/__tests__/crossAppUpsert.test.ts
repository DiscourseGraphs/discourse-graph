import { describe, expect, it } from "vitest";
import type {
  CrossAppBase,
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
  CrossAppRelationTypeSchema,
  CrossAppUpsertData,
} from "../../crossAppContracts";
import {
  findMissingSchemas,
  mapUpsertResults,
  parseUpsertData,
  schemaReferences,
  toOrderedEntries,
  type StoredSchema,
} from "../crossAppUpsert";

type JsonObject = Record<string, unknown>;

const toJson = (value: object): JsonObject =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

const without = (value: object, key: string): JsonObject => {
  const json = toJson(value);
  delete json[key];
  return json;
};

const base = (localId: string): CrossAppBase => ({
  localId,
  createdAt: new Date("2026-06-14T11:00:00Z"),
  authorId: "account-local-1",
});

const claimType: CrossAppNodeSchema = { ...base("claim-type"), label: "Claim" };
const sourceType: CrossAppNodeSchema = {
  ...base("source-type"),
  label: "Source",
};
const evidenceType: CrossAppNodeSchema = {
  ...base("evidence-type"),
  label: "Evidence",
  slotDefinitions: { source: "source-type" },
};
const supports: CrossAppRelationTypeSchema = {
  ...base("supports"),
  label: "supports",
  complement: "is supported by",
};
const evidenceSupportsClaim: CrossAppRelationTripleSchema = {
  ...base("evidence-supports-claim"),
  relation: "supports",
  sourceType: "evidence-type",
  destinationType: "claim-type",
};

const node = (
  localId: string,
  nodeType: string,
  slots?: Record<string, string>,
): CrossAppNode => ({
  ...base(localId),
  nodeType,
  coreTitle: localId,
  content: { direct: { value: localId } },
  ...(slots ? { slots } : {}),
});

const relation: CrossAppRelation = {
  ...base("relation-1"),
  relationType: "evidence-supports-claim",
  source: "evidence-1",
  destination: "claim-1",
};

// The citing node comes before its Source, so ordering has to move it.
const graph: CrossAppUpsertData = {
  nodeSchemas: [evidenceType, claimType, sourceType],
  relationTypeSchemas: [supports],
  relationTripleSchemas: [evidenceSupportsClaim],
  nodes: [
    node("evidence-1", "evidence-type", { source: "source-1" }),
    node("claim-1", "claim-type"),
    node("source-1", "source-type"),
  ],
  relations: [relation],
};

const storedSupports: StoredSchema = {
  source_local_id: "supports",
  literal_content: {
    roles: ["source", "destination"],
    label: "supports",
    complement: "is supported by",
  },
};

const SPACE_URL = "https://roamresearch.com/#/app/graph-a";

const parse = (body: unknown): ReturnType<typeof parseUpsertData> =>
  parseUpsertData({ body, spaceUrl: SPACE_URL });

const deeplyNested = (depth: number): unknown =>
  JSON.parse(
    `{"nodeSchemas":[{"localId":"deep","createdAt":"2026-06-14T11:00:00Z","authorId":"a","label":"Deep","metadata":${'{"a":'.repeat(depth)}1${"}".repeat(depth)}}]}`,
  );

describe("parseUpsertData", () => {
  it("parses a body sent as JSON back to the contract values", () => {
    expect(parse(toJson(graph))).toStrictEqual({ success: true, data: graph });
  });

  it.each([
    { when: "is empty", body: {} },
    {
      when: "has an item whose rid names the path's space",
      body: {
        nodeSchemas: [toJson({ ...claimType, rid: `${SPACE_URL}/claim-type` })],
      },
    },
    {
      when: "has a relation whose destination is a RID in another space",
      body: {
        relations: [
          toJson({
            ...relation,
            destination: "https://roamresearch.com/#/app/graph-b/claim-9",
          }),
        ],
      },
    },
  ])("accepts a body that $when", ({ body }) => {
    expect(parse(body).success).toBe(true);
  });

  it.each([
    {
      when: "reuses a local id in another array",
      body: {
        nodes: [toJson(node("x", "claim-type"))],
        relations: [toJson({ ...relation, localId: "x" })],
      },
      issues: [
        {
          path: ["relations", 0, "localId"],
          message: "Another item in the body has this local id",
        },
      ],
    },
    {
      when: "has a triple schema without a source type",
      body: {
        relationTripleSchemas: [without(evidenceSupportsClaim, "sourceType")],
      },
      issues: [
        {
          path: ["relationTripleSchemas", 0, "sourceType"],
          message: "Required",
        },
      ],
    },
    {
      when: "has a rid that is not a RID",
      body: { relations: [toJson({ ...relation, rid: "relation-1" })] },
      issues: [
        {
          path: ["relations", 0, "rid"],
          message: "Not an https:// or orn: RID",
        },
      ],
    },
    ...["https://roamresearch.com/#/app/graph-b/relation-1", "orn:"].map(
      (rid) => ({
        when: `has an item whose rid is ${rid}`,
        body: { relations: [toJson({ ...relation, rid })] },
        issues: [
          {
            path: ["relations", 0, "rid"],
            message: "The rid names a space other than the one in the path",
          },
        ],
      }),
    ),
    {
      when: "has a node with assets",
      body: {
        nodes: [
          toJson({
            ...node("claim-1", "claim-type"),
            assets: [{ sourceRef: "a.png", contentHash: "ab" }],
          }),
        ],
      },
      issues: [
        {
          path: ["nodes", 0, "assets"],
          message: "This route does not write this field yet",
        },
      ],
    },
    {
      when: "has a schema with metadata",
      body: { relationTypeSchemas: [toJson({ ...supports, metadata: {} })] },
      issues: [
        {
          path: ["relationTypeSchemas", 0, "metadata"],
          message: "This route does not write this field yet",
        },
      ],
    },
    {
      when: "has metadata nested 100,000 levels deep",
      body: deeplyNested(100_000),
      issues: [{ path: [], message: "The body is nested too deeply" }],
    },
  ])("refuses a body that $when", ({ body, issues }) => {
    expect(parse(body)).toEqual({ success: false, issues });
  });

  it("refuses a key outside the five root types", () => {
    expect(parse({ edges: [] })).toMatchObject({
      success: false,
      issues: [{ path: [] }],
    });
  });
});

describe("schemaReferences", () => {
  it("lists schema ids that are neither RIDs nor in the body", () => {
    const references = schemaReferences({
      nodeSchemas: [evidenceType],
      relationTypeSchemas: [supports],
      relationTripleSchemas: [
        {
          ...evidenceSupportsClaim,
          destinationType: "orn:roam.schema:graph-b/claim-type",
        },
        {
          ...evidenceSupportsClaim,
          localId: "evidence-contradicts-claim",
          relation: "contradicts",
        },
      ],
      nodes: [
        node("claim-1", "claim-type"),
        node("other-1", "https://example.com/space-b/other-type"),
      ],
      relations: [
        relation,
        { ...relation, localId: "relation-2", relationType: "claim-on-claim" },
      ],
    });
    expect(references.sort()).toEqual([
      "claim-on-claim",
      "claim-type",
      "contradicts",
      "source-type",
    ]);
  });

  it("keeps a triple's relation type when it is a RID", () => {
    const rid = "orn:roam.schema:graph-b/supports";
    expect(
      schemaReferences({
        nodeSchemas: [claimType, evidenceType, sourceType],
        relationTripleSchemas: [{ ...evidenceSupportsClaim, relation: rid }],
      }),
    ).toEqual([rid]);
  });
});

describe("findMissingSchemas", () => {
  const nodesOnly: CrossAppUpsertData = {
    relationTripleSchemas: [evidenceSupportsClaim],
    nodes: [node("claim-1", "claim-type")],
  };

  it("returns the references the database does not hold", () => {
    expect(
      findMissingSchemas({
        data: nodesOnly,
        storedSchemas: [
          storedSupports,
          {
            source_local_id: "claim-type",
            literal_content: { label: "Claim" },
          },
        ],
      }).sort(),
    ).toEqual(["evidence-type"]);
  });

  it("counts a stored relation type without label and complement as missing", () => {
    expect(
      findMissingSchemas({
        data: { relationTripleSchemas: [evidenceSupportsClaim] },
        storedSchemas: [
          { source_local_id: "supports", literal_content: { label: "x" } },
          { source_local_id: "evidence-type", literal_content: {} },
          { source_local_id: "claim-type", literal_content: {} },
        ],
      }),
    ).toEqual(["supports"]);
  });
});

describe("toOrderedEntries", () => {
  it("puts every concept after the concepts it references", () => {
    const ids = toOrderedEntries({ data: graph, storedSchemas: [] }).map(
      (e) => e.localId,
    );
    expect([...ids].sort()).toEqual(
      [
        "claim-1",
        "claim-type",
        "evidence-1",
        "evidence-supports-claim",
        "evidence-type",
        "relation-1",
        "source-1",
        "source-type",
        "supports",
      ].sort(),
    );
    const before = (first: string, second: string): void =>
      expect(ids.indexOf(first)).toBeLessThan(ids.indexOf(second));
    before("source-type", "evidence-type");
    before("evidence-type", "evidence-1");
    before("source-type", "source-1");
    before("source-1", "evidence-1");
    before("supports", "evidence-supports-claim");
    before("evidence-supports-claim", "relation-1");
    before("evidence-1", "relation-1");
    before("claim-1", "relation-1");
  });

  it.each([
    { from: "the body", data: graph, storedSchemas: [] },
    {
      from: "the database",
      data: { relationTripleSchemas: [evidenceSupportsClaim] },
      storedSchemas: [storedSupports],
    },
  ])(
    "gives a triple its relation type's label and complement from $from",
    ({ data, storedSchemas }) => {
      const triple = toOrderedEntries({ data, storedSchemas }).find(
        (e) => e.localId === "evidence-supports-claim",
      );
      expect(triple?.concept.literal_content).toEqual({
        roles: ["source", "destination"],
        label: "supports",
        complement: "is supported by",
      });
    },
  );

  it("throws for a triple whose relation type was not found", () => {
    expect(() =>
      toOrderedEntries({
        data: { relationTripleSchemas: [evidenceSupportsClaim] },
        storedSchemas: [],
      }),
    ).toThrow("evidence-supports-claim");
  });
});

describe("mapUpsertResults", () => {
  it("maps each result to the local id at its position after ordering", () => {
    const entries = toOrderedEntries({ data: graph, storedSchemas: [] });
    const failures: Record<string, number> = {
      "evidence-1": -1,
      "relation-1": -2,
    };
    const ids = entries.map((e, index) => failures[e.localId] ?? 100 + index);
    const { upserted, failed } = mapUpsertResults({ entries, ids });
    expect(failed).toEqual([
      { localId: "evidence-1", kind: "nodes", reason: "name_conflict" },
      { localId: "relation-1", kind: "relations", reason: "error" },
    ]);
    expect(upserted["source-1"]).toBe(
      100 + entries.findIndex((e) => e.localId === "source-1"),
    );
    expect(Object.keys(upserted)).toHaveLength(entries.length - 2);
  });
});
