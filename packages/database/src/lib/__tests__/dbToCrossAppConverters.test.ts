import { describe, expect, it, vi } from "vitest";
import {
  dbNodeSchemaToCrossApp,
  dbNodeToCrossApp,
  dbNodesToCrossApp,
  dbRelationTypeSchemaToCrossApp,
  dbRelationTripleSchemaToCrossApp,
  dbRelationToCrossApp,
  dbRelationsToCrossApp,
  type DbNodeConcept,
  type DbNodeContent,
  type DbNodeRow,
} from "../dbToCrossAppConverters";
import { Tables, Json } from "../../dbTypes";
import type { DGSupabaseClient } from "../client";

type Concept = Tables<"Concept">;

const spaceMap: Record<number, string> = { 1: "obsidian:vault-a" };
const accountMap: Record<number, string> = { 42: "account-local-1" };

/* eslint-disable @typescript-eslint/naming-convention */
const baseConcept = ({
  id = 1,
  literal_content = {},
  reference_content = {},
  ...overrides
}: Partial<Concept> & {
  literal_content?: Json;
  reference_content?: Json;
} = {}): Concept => ({
  id,
  arity: 0,
  is_relation: false,
  author_id: 42,
  created: "2026-06-14T11:00:00",
  description: null,
  epistemic_status: "certainly-not" as Concept["epistemic_status"],
  is_schema: true,
  last_modified: "2026-06-14T13:00:00",
  literal_content,
  name: "Some concept",
  reference_content,
  refs: [],
  schema_id: null,
  source_local_id: "concept-1",
  space_id: 1,
  ...overrides,
});
/* eslint-enable @typescript-eslint/naming-convention  */

describe("dbNodeSchemaToCrossApp", () => {
  it("converts a node schema, splitting out template fields from metadata", () => {
    const schema = baseConcept({
      literal_content: {
        template: "Template Title",
        template_content: "template body",
        extra: "kept",
      },
    });
    expect(
      dbNodeSchemaToCrossApp({ schema, spaceMap, accountMap, schemaMap: {} }),
    ).toEqual({
      rid: "orn:obsidian.schema:vault-a/concept-1",
      localId: "concept-1",
      createdAt: new Date("2026-06-14T11:00:00Z"),
      modifiedAt: new Date("2026-06-14T13:00:00Z"),
      label: "Some concept",
      metadata: { extra: "kept" },
      slotDefinitions: {},
      template: "template body",
      templateTitle: "Template Title",
      authorId: "account-local-1",
    });
  });

  it("resolves slot definitions from roles and reference content", () => {
    const schema = baseConcept({
      literal_content: { roles: ["evidence", "claim"], extra: "kept" },
      reference_content: { evidence: 10, claim: 20 },
    });
    const result = dbNodeSchemaToCrossApp({
      schema,
      spaceMap,
      accountMap,
      schemaMap: {
        10: "orn:obsidian.schema:vault-a/evidence-type",
        20: "orn:obsidian.schema:vault-a/claim-type",
      },
    });
    // schemas are always local, so slots hold plain source local ids
    expect(result.slotDefinitions).toEqual({
      evidence: "evidence-type",
      claim: "claim-type",
    });
    // roles drive the slot definitions, they are not kept as plain metadata
    expect(result.metadata).toEqual({ extra: "kept" });
  });

  it("throws when a slot points at a schema in another space", () => {
    const schema = baseConcept({
      literal_content: { roles: ["evidence"] },
      reference_content: { evidence: 10 },
    });
    expect(() =>
      dbNodeSchemaToCrossApp({
        schema,
        spaceMap,
        accountMap,
        schemaMap: { 10: "orn:obsidian.schema:vault-b/evidence-type" },
      }),
    ).toThrow("Unexpected spaceUri");
  });

  it("omits slots whose referenced schema cannot be resolved", () => {
    const schema = baseConcept({
      literal_content: { roles: ["evidence", "claim"] },
      reference_content: { evidence: 10 },
    });
    expect(
      dbNodeSchemaToCrossApp({
        schema,
        spaceMap,
        accountMap,
        schemaMap: { 10: "orn:obsidian.schema:vault-a/evidence-type" },
      }).slotDefinitions,
    ).toEqual({ evidence: "evidence-type" });
  });

  it("throws when the author is unknown", () => {
    const schema = baseConcept({ author_id: 999 });
    expect(() =>
      dbNodeSchemaToCrossApp({ schema, spaceMap, accountMap, schemaMap: {} }),
    ).toThrow("Missing author");
  });

  it("throws when the space is unknown", () => {
    const schema = baseConcept({ space_id: 999 });
    expect(() =>
      dbNodeSchemaToCrossApp({ schema, spaceMap, accountMap, schemaMap: {} }),
    ).toThrow("Missing space");
  });
});

describe("dbRelationTypeSchemaToCrossApp", () => {
  it("converts a relation type schema, splitting out label/complement from metadata", () => {
    const schema = baseConcept({
      literal_content: {
        roles: ["source", "destination"],
        label: "supports",
        complement: "is supported by",
        extra: "kept",
      },
    });
    expect(
      dbRelationTypeSchemaToCrossApp(schema, spaceMap, accountMap),
    ).toEqual({
      rid: "orn:obsidian.schema:vault-a/concept-1",
      localId: "concept-1",
      createdAt: new Date("2026-06-14T11:00:00Z"),
      modifiedAt: new Date("2026-06-14T13:00:00Z"),
      metadata: { extra: "kept" },
      label: "supports",
      complement: "is supported by",
      authorId: "account-local-1",
    });
  });
});

describe("dbRelationTripleSchemaToCrossApp", () => {
  const conceptMap: Record<number, string> = {
    10: "orn:obsidian.schema:vault-a/relation-type-1",
    20: "orn:obsidian.schema:vault-a/source-type-1",
    30: "orn:obsidian.schema:vault-a/destination-type-1",
  };

  it("uses the relation_type reference when present, resolved to a local id", () => {
    const schema = baseConcept({
      reference_content: { relation_type: 10, source: 20, destination: 30 },
    });
    const result = dbRelationTripleSchemaToCrossApp({
      schema,
      spaceMap,
      accountMap,
      conceptMap,
    });
    expect(result).toMatchObject({
      relation: "relation-type-1",
      sourceType: "source-type-1",
      destinationType: "destination-type-1",
    });
    expect(result).not.toHaveProperty("label");
  });

  it("falls back to literal label/complement when no relation_type reference exists", () => {
    const schema = baseConcept({
      literal_content: { label: "supports", complement: "is supported by" },
      reference_content: { source: 20, destination: 30 },
    });
    const result = dbRelationTripleSchemaToCrossApp({
      schema,
      spaceMap,
      accountMap,
      conceptMap,
    });
    expect(result).toMatchObject({
      label: "supports",
      complement: "is supported by",
    });
    expect(result).not.toHaveProperty("relation");
  });

  it("throws when neither relation_type nor label/complement are present", () => {
    const schema = baseConcept({
      reference_content: { source: 20, destination: 30 },
    });
    expect(() =>
      dbRelationTripleSchemaToCrossApp({
        schema,
        spaceMap,
        accountMap,
        conceptMap,
      }),
    ).toThrow("Missing either relation_type or relation_type data");
  });

  it("throws when the source type is missing", () => {
    const schema = baseConcept({
      reference_content: { relation_type: 10, destination: 30 },
    });
    expect(() =>
      dbRelationTripleSchemaToCrossApp({
        schema,
        spaceMap,
        accountMap,
        conceptMap,
      }),
    ).toThrow("Missing source type");
  });

  it("throws when the destination type is missing", () => {
    const schema = baseConcept({
      reference_content: { relation_type: 10, source: 20 },
    });
    expect(() =>
      dbRelationTripleSchemaToCrossApp({
        schema,
        spaceMap,
        accountMap,
        conceptMap,
      }),
    ).toThrow("Missing destination type");
  });
});

describe("dbRelationToCrossApp", () => {
  const conceptMap: Record<number, string> = {
    10: "orn:obsidian.schema:vault-a/relation-type-1",
    20: "orn:obsidian.note:vault-a/source-node-1",
    30: "orn:obsidian.note:vault-a/destination-node-1",
  };

  it("converts a relation, resolving type/source/destination to local ids", () => {
    const relation = baseConcept({
      is_schema: false,
      schema_id: 10,
      reference_content: { source: 20, destination: 30 },
    });
    expect(
      dbRelationToCrossApp({ relation, spaceMap, accountMap, conceptMap }),
    ).toEqual({
      rid: "orn:obsidian.relation:vault-a/concept-1",
      localId: "concept-1",
      authorId: "account-local-1",
      createdAt: new Date("2026-06-14T11:00:00Z"),
      modifiedAt: new Date("2026-06-14T13:00:00Z"),
      source: "source-node-1",
      destination: "destination-node-1",
      relationType: "relation-type-1",
    });
  });

  it("keeps source/destination as a full rid when it points to a different space", () => {
    const relation = baseConcept({
      is_schema: false,
      schema_id: 10,
      reference_content: { source: 20, destination: 30 },
    });
    const foreignConceptMap = {
      ...conceptMap,
      20: "orn:obsidian.note:vault-b/source-node-1",
    };
    expect(
      dbRelationToCrossApp({
        relation,
        spaceMap,
        accountMap,
        conceptMap: foreignConceptMap,
      }).source,
    ).toBe("orn:obsidian.note:vault-b/source-node-1");
  });

  it("throws when the relation type is missing", () => {
    const relation = baseConcept({
      is_schema: false,
      schema_id: 999,
      reference_content: { source: 20, destination: 30 },
    });
    expect(() =>
      dbRelationToCrossApp({ relation, spaceMap, accountMap, conceptMap }),
    ).toThrow("Missing relationType");
  });
});

describe("dbRelationsToCrossApp endpoint rids", () => {
  const crossSpaceMap: Record<number, string> = {
    1: "obsidian:vault-a",
    2: "obsidian:vault-b",
    3: "https://roamresearch.com/#/app/research-graph",
  };

  const conceptRows = [
    {
      id: 10,
      space_id: 1,
      source_local_id: "relation-type-1",
      is_schema: true,
      is_relation: true,
    },
    {
      id: 20,
      space_id: 2,
      source_local_id: "source-node-1",
      is_schema: false,
      is_relation: false,
    },
    {
      id: 30,
      space_id: 3,
      source_local_id: "roam-uid-1",
      is_schema: false,
      is_relation: false,
    },
  ];

  const makeClient = (): DGSupabaseClient => {
    const result = { data: conceptRows, error: null };
    const builder = {
      select: vi.fn(),
      in: vi.fn(),
      not: vi.fn(),
      then: (
        resolve: (value: typeof result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    builder.select.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.not.mockReturnValue(builder);
    return { from: vi.fn(() => builder) } as unknown as DGSupabaseClient;
  };

  const relation = baseConcept({
    is_schema: false,
    schema_id: 10,
    reference_content: { source: 20, destination: 30 },
  });

  // The Obsidian rid must match the `importedFrom.sourceNodeRid` Roam stores for
  // an imported note, or importSharedRelations cannot resolve the endpoint.
  it("gives an Obsidian endpoint the note subtype", async () => {
    const [converted] = await dbRelationsToCrossApp({
      client: makeClient(),
      relations: [relation],
      accountMap,
      spaceMap: crossSpaceMap,
    });
    expect(converted?.source).toBe("orn:obsidian.note:vault-b/source-node-1");
  });

  it("leaves a Roam endpoint as a url rid with no subtype", async () => {
    const [converted] = await dbRelationsToCrossApp({
      client: makeClient(),
      relations: [relation],
      accountMap,
      spaceMap: crossSpaceMap,
    });
    expect(converted?.destination).toBe(
      "https://roamresearch.com/#/app/research-graph/roam-uid-1",
    );
  });
});

describe("dbNodeToCrossApp", () => {
  const nodeSpaceMap: Record<number, string> = {
    20: "obsidian:vault-a",
    21: "obsidian:vault-b",
  };
  const schemaMap: Record<number, string> = {
    200: "orn:obsidian.schema:vault-a/evd-type",
  };
  const concept: DbNodeConcept = {
    core_title: "REM sleep and recall",
    is_schema: false,
    last_modified: "2026-06-14T12:00:00",
    schema_id: 200,
    source_local_id: "node-1",
    space_id: 20,
    reference_content: {},
    concepts_of_relation: [],
  };
  const direct: DbNodeContent = {
    author_id: 42,
    created: "2026-06-14T11:00:00",
    last_modified: "2026-06-14T13:00:00",
    metadata: { filePath: "EVD - REM sleep and recall.md" },
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
    variant: "direct",
  };
  const row: DbNodeRow = {
    concept,
    direct,
    fullLastModified: "2026-06-14T15:00:00",
  };
  const convert = (
    overrides: Partial<DbNodeRow> = {},
    formatMap: Record<number, string> = { 200: "EVD - {content}" },
  ) =>
    dbNodeToCrossApp({
      row: { ...row, ...overrides },
      spaceMap: nodeSpaceMap,
      accountMap,
      schemaMap,
      formatMap,
    });

  it("converts a node with local ids for its author and node type", () => {
    expect(convert()).toEqual({
      rid: "orn:obsidian.note:vault-a/node-1",
      localId: "node-1",
      createdAt: new Date("2026-06-14T11:00:00Z"),
      modifiedAt: new Date("2026-06-14T15:00:00Z"),
      authorId: "account-local-1",
      nodeType: "evd-type",
      coreTitle: "REM sleep and recall",
      content: { direct: { value: "EVD - REM sleep and recall" } },
    });
  });

  it("gives a Roam node and a slot target in a Roam space url rids without a subtype", () => {
    const roamGraph = "https://roamresearch.com/#/app/research-graph";
    const converted = dbNodeToCrossApp({
      row: {
        ...row,
        concept: {
          ...concept,
          space_id: 22,
          reference_content: { sourceDocument: 8 },
          concepts_of_relation: [
            { id: 8, space_id: 22, source_local_id: "roam-uid-8" },
          ],
        },
      },
      spaceMap: { 22: roamGraph },
      accountMap,
      schemaMap: { 200: `${roamGraph}/evd-type` },
      formatMap: {},
    });
    expect(converted.rid).toBe(`${roamGraph}/node-1`);
    expect(converted.nodeType).toBe("evd-type");
    expect(converted.slots).toEqual({ sourceDocument: "roam-uid-8" });
    expect(
      dbNodeToCrossApp({
        row: {
          ...row,
          concept: {
            ...concept,
            reference_content: { sourceDocument: 8 },
            concepts_of_relation: [
              { id: 8, space_id: 22, source_local_id: "roam-uid-8" },
            ],
          },
        },
        spaceMap: { ...nodeSpaceMap, 22: roamGraph },
        accountMap,
        schemaMap,
        formatMap: {},
      }).slots,
    ).toEqual({ sourceDocument: `${roamGraph}/roam-uid-8` });
  });

  it("leaves out a slot whose target has no local id", () => {
    expect(
      convert({
        concept: {
          ...concept,
          reference_content: { evidence: 5 },
          concepts_of_relation: [
            { id: 5, space_id: 20, source_local_id: null },
          ],
        },
      }).slots,
    ).toBeUndefined();
  });

  it("gives a slot target as a local id in the same space and as a rid in another space", () => {
    expect(
      convert({
        concept: {
          ...concept,
          reference_content: { evidence: 5, claim: 6, dangling: 7 },
          concepts_of_relation: [
            { id: 5, space_id: 20, source_local_id: "node-5" },
            { id: 6, space_id: 21, source_local_id: "node-6" },
          ],
        },
      }).slots,
    ).toEqual({
      evidence: "node-5",
      claim: "orn:obsidian.note:vault-b/node-6",
    });
  });

  it.each([
    {
      latest: "concept",
      overrides: {
        concept: { ...concept, last_modified: "2026-06-14T16:00:00" },
      },
    },
    {
      latest: "direct content",
      overrides: {
        direct: { ...direct, last_modified: "2026-06-14T16:00:00" },
      },
    },
    {
      latest: "full content",
      overrides: { fullLastModified: "2026-06-14T16:00:00" },
    },
  ])(
    "takes modifiedAt from the $latest when it changed last",
    ({ overrides }) => {
      expect(convert(overrides).modifiedAt).toEqual(
        new Date("2026-06-14T16:00:00Z"),
      );
    },
  );

  it("derives the core title from the node type's format when none was published", () => {
    expect(
      convert({ concept: { ...concept, core_title: null } }).coreTitle,
    ).toBe("REM sleep and recall");
  });

  it("uses the title as the core title when the node type has no format", () => {
    expect(
      convert({ concept: { ...concept, core_title: null } }, { 200: "" })
        .coreTitle,
    ).toBe("EVD - REM sleep and recall");
  });

  it.each([
    {
      error: "Missing author",
      overrides: { direct: { ...direct, author_id: null } },
    },
    {
      error: "Missing node type",
      overrides: { concept: { ...concept, schema_id: 999 } },
    },
    {
      error: "Missing created date",
      overrides: { direct: { ...direct, created: null } },
    },
    { error: "Missing direct content", overrides: { direct: undefined } },
    {
      error: "Missing space",
      overrides: { concept: { ...concept, space_id: 999 } },
    },
  ])("throws $error", ({ error, overrides }) => {
    expect(() => convert(overrides)).toThrow(error);
  });
});

describe("dbNodesToCrossApp", () => {
  const concept = (sourceLocalId: string): DbNodeConcept => ({
    core_title: `Title of ${sourceLocalId}`,
    is_schema: false,
    last_modified: "2026-06-14T12:00:00",
    schema_id: 200,
    source_local_id: sourceLocalId,
    space_id: 20,
    reference_content: {},
    concepts_of_relation: [],
  });
  const direct = (
    sourceLocalId: string,
    authorId: number | null,
  ): DbNodeContent => ({
    author_id: authorId,
    created: "2026-06-14T11:00:00",
    last_modified: "2026-06-14T13:00:00",
    metadata: {},
    source_local_id: sourceLocalId,
    space_id: 20,
    text: `EVD - Title of ${sourceLocalId}`,
    variant: "direct",
  });

  const makeClient = () => {
    const rowsByTable: Record<string, unknown[]> = {
      my_accounts: [{ id: 42, account_local_id: "account-local-1" }],
      my_concepts: [
        {
          id: 200,
          space_id: 20,
          source_local_id: "evd-type",
          is_schema: true,
          is_relation: false,
          format: null,
          sourceDataFormat: "EVD - {content}",
        },
      ],
    };
    const inCalls: Record<string, unknown[][]> = {};
    const from = vi.fn((table: string) => {
      const result = { data: rowsByTable[table], error: null };
      const builder = {
        select: vi.fn(),
        in: vi.fn((column: string, values: unknown[]) => {
          (inCalls[table] ??= []).push(values);
          return builder;
        }),
        not: vi.fn(),
        then: (
          resolve: (value: typeof result) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
      };
      builder.select.mockReturnValue(builder);
      builder.not.mockReturnValue(builder);
      return builder;
    });
    return { client: { from } as unknown as DGSupabaseClient, inCalls };
  };

  it("looks up the author, node type and node type format of each node", async () => {
    const { client, inCalls } = makeClient();
    const converted = await dbNodesToCrossApp({
      client,
      nodes: [{ ...concept("node-1"), core_title: null }],
      directContents: [direct("node-1", 42)],
      fullContentSummaries: [],
      spaceMap: { 20: "obsidian:vault-a" },
    });
    expect(inCalls).toEqual({
      my_accounts: [[42]],
      my_concepts: [[200], [200]],
    });
    expect(converted).toMatchObject([
      {
        localId: "node-1",
        authorId: "account-local-1",
        nodeType: "evd-type",
        coreTitle: "Title of node-1",
      },
    ]);
  });

  it("looks up node type formats only for nodes published without a core title", async () => {
    const { client, inCalls } = makeClient();
    await dbNodesToCrossApp({
      client,
      nodes: [concept("node-1")],
      directContents: [direct("node-1", 42)],
      fullContentSummaries: [],
      spaceMap: { 20: "obsidian:vault-a" },
    });
    expect(inCalls.my_concepts).toEqual([[200]]);
  });

  it("skips and logs a node the contract cannot represent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = makeClient();
    const converted = await dbNodesToCrossApp({
      client,
      nodes: [concept("node-1"), concept("node-2"), concept("node-3")],
      directContents: [direct("node-1", 42), direct("node-2", null)],
      fullContentSummaries: [],
      spaceMap: { 20: "obsidian:vault-a" },
    });
    expect(converted.map(({ localId }) => localId)).toEqual(["node-1"]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      "Skipped node node-2 of space 20:",
      new Error("Missing author"),
    );
    expect(warn).toHaveBeenCalledWith(
      "Skipped node node-3 of space 20:",
      new Error("Missing direct content"),
    );
    warn.mockRestore();
  });
});
