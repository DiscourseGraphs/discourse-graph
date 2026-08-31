import { describe, expect, it } from "vitest";
import {
  dbNodeSchemaToCrossApp,
  dbNodeToCrossApp,
  dbRelationTypeSchemaToCrossApp,
  dbRelationTripleSchemaToCrossApp,
  dbRelationToCrossApp,
} from "../dbToCrossAppConverters";
import { Tables, Json } from "../../dbTypes";

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
    20: "orn:obsidian.node:vault-a/source-node-1",
    30: "orn:obsidian.node:vault-a/destination-node-1",
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
      20: "orn:obsidian.node:vault-b/source-node-1",
    };
    expect(
      dbRelationToCrossApp({
        relation,
        spaceMap,
        accountMap,
        conceptMap: foreignConceptMap,
      }).source,
    ).toBe("orn:obsidian.node:vault-b/source-node-1");
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

describe("dbNodeToCrossApp", () => {
  const conceptMap: Record<number, string> = {
    10: "orn:obsidian.schema:vault-a/claim-type",
  };

  it("converts a node, reading core_title from literal_content", () => {
    const node = baseConcept({
      is_schema: false,
      schema_id: 10,
      name: "CLM - my claim",
      literal_content: { core_title: "my claim" },
    });
    expect(
      dbNodeToCrossApp({ node, spaceMap, accountMap, conceptMap }),
    ).toEqual({
      rid: "orn:obsidian.node:vault-a/concept-1",
      localId: "concept-1",
      authorId: "account-local-1",
      createdAt: new Date("2026-06-14T11:00:00Z"),
      modifiedAt: new Date("2026-06-14T13:00:00Z"),
      nodeType: "claim-type",
      coreTitle: "my claim",
      content: {
        direct: { localId: "concept-1", value: "CLM - my claim" },
      },
    });
  });

  it("preserves a matched-empty core_title", () => {
    const node = baseConcept({
      is_schema: false,
      schema_id: 10,
      literal_content: { core_title: "" },
    });
    expect(
      dbNodeToCrossApp({ node, spaceMap, accountMap, conceptMap }).coreTitle,
    ).toBe("");
  });

  it("falls back to the name when core_title is absent", () => {
    const node = baseConcept({ is_schema: false, schema_id: 10 });
    expect(
      dbNodeToCrossApp({ node, spaceMap, accountMap, conceptMap }).coreTitle,
    ).toBe("Some concept");
  });

  it("throws when the node type is missing", () => {
    const node = baseConcept({ is_schema: false, schema_id: 999 });
    expect(() =>
      dbNodeToCrossApp({ node, spaceMap, accountMap, conceptMap }),
    ).toThrow("Missing nodeType");
  });
});
