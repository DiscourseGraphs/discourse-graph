import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
  CrossAppRelationTypeSchema,
} from "../crossAppContracts";
import {
  obsidianOriginNodeExample,
  roamOriginNodeExample,
} from "../crossAppNodeContract.example";
import {
  crossAppNodeSchemaValidator,
  crossAppNodeValidator,
  crossAppRelationTripleSchemaValidator,
  crossAppRelationTypeSchemaValidator,
  crossAppRelationValidator,
} from "../crossAppValidators";

type JsonObject = Record<string, unknown>;

const toJson = (value: object): JsonObject =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

const without = (value: object, key: string): JsonObject => {
  const json = toJson(value);
  delete json[key];
  return json;
};

const createdAt = new Date("2026-06-14T11:00:00Z");
const authorId = "account-local-1";

const nodeSchema: CrossAppNodeSchema = {
  localId: "concept-1",
  rid: "orn:obsidian.schema:vault-a/concept-1",
  createdAt,
  modifiedAt: new Date("2026-06-14T13:00:00Z"),
  authorId,
  metadata: { extra: "kept", nested: [1, null, { deep: true }] },
  label: "Claim",
  template: "* Evidence\n",
  templateTitle: "Claim template",
  format: "[[CLM]] - {content}",
  slotDefinitions: { evidence: "evidence-type" },
};

const relationTypeSchema: CrossAppRelationTypeSchema = {
  localId: "relation-type-1",
  createdAt,
  authorId,
  label: "supports",
  complement: "is supported by",
};

const tripleEndpoints = {
  sourceType: "source-type-1",
  destinationType: "destination-type-1",
};

const tripleWithLabels: CrossAppRelationTripleSchema = {
  localId: "triple-1",
  createdAt,
  authorId,
  label: "supports",
  complement: "is supported by",
  ...tripleEndpoints,
};

const tripleWithRelationType: CrossAppRelationTripleSchema = {
  localId: "triple-2",
  createdAt,
  authorId,
  relation: "relation-type-1",
  ...tripleEndpoints,
};

const relation: CrossAppRelation = {
  localId: "relation-1",
  rid: "orn:obsidian.relation:vault-a/relation-1",
  createdAt,
  authorId,
  relationType: "relation-type-1",
  source: "source-node-1",
  destination: "orn:obsidian.note:vault-b/destination-node-1",
};

const node = toJson(roamOriginNodeExample);
const nodeContent = node.content as JsonObject;
const nodeDirect = nodeContent.direct as JsonObject;
const nodeFull = nodeContent.full as JsonObject;

describe("cross-app validators", () => {
  it("parse to exactly their contract types", () => {
    expectTypeOf<
      z.output<typeof crossAppNodeSchemaValidator>
    >().branded.toEqualTypeOf<CrossAppNodeSchema>();
    expectTypeOf<
      z.output<typeof crossAppRelationTypeSchemaValidator>
    >().branded.toEqualTypeOf<CrossAppRelationTypeSchema>();
    expectTypeOf<
      z.output<typeof crossAppRelationTripleSchemaValidator>
    >().branded.toEqualTypeOf<CrossAppRelationTripleSchema>();
    expectTypeOf<
      z.output<typeof crossAppNodeValidator>
    >().branded.toEqualTypeOf<CrossAppNode>();
    expectTypeOf<
      z.output<typeof crossAppRelationValidator>
    >().branded.toEqualTypeOf<CrossAppRelation>();
  });

  it.each([
    {
      name: "node schema",
      validator: crossAppNodeSchemaValidator,
      value: nodeSchema,
    },
    {
      name: "relation type schema",
      validator: crossAppRelationTypeSchemaValidator,
      value: relationTypeSchema,
    },
    {
      name: "triple schema with labels",
      validator: crossAppRelationTripleSchemaValidator,
      value: tripleWithLabels,
    },
    {
      name: "triple schema with a relation type",
      validator: crossAppRelationTripleSchemaValidator,
      value: tripleWithRelationType,
    },
    {
      name: "Roam node",
      validator: crossAppNodeValidator,
      value: roamOriginNodeExample,
    },
    {
      name: "Obsidian node",
      validator: crossAppNodeValidator,
      value: obsidianOriginNodeExample,
    },
    { name: "relation", validator: crossAppRelationValidator, value: relation },
  ])(
    "parses a $name sent as JSON back to the contract value",
    ({ validator, value }) => {
      expect(validator.parse(toJson(value))).toEqual(value);
    },
  );

  it.each([
    {
      validator: crossAppNodeSchemaValidator,
      when: "node schema has no label",
      value: without(nodeSchema, "label"),
      path: ["label"],
    },
    {
      validator: crossAppNodeSchemaValidator,
      when: "node schema slot definition is not a string",
      value: { ...toJson(nodeSchema), slotDefinitions: { evidence: 5 } },
      path: ["slotDefinitions", "evidence"],
    },
    {
      validator: crossAppNodeSchemaValidator,
      when: "node schema has a key the contract does not define",
      value: { ...toJson(nodeSchema), colour: "red" },
      path: [],
    },
    {
      validator: crossAppRelationTypeSchemaValidator,
      when: "relation type schema has no complement",
      value: without(relationTypeSchema, "complement"),
      path: ["complement"],
    },
    {
      validator: crossAppRelationTypeSchemaValidator,
      when: "relation type schema label is not a string",
      value: { ...toJson(relationTypeSchema), label: 3 },
      path: ["label"],
    },
    {
      validator: crossAppRelationTripleSchemaValidator,
      when: "triple schema has a label but no complement",
      value: without(tripleWithLabels, "complement"),
      path: [],
    },
    {
      validator: crossAppRelationTripleSchemaValidator,
      when: "triple schema has both labels and a relation type",
      value: { ...toJson(tripleWithLabels), relation: "relation-type-1" },
      path: [],
    },
    {
      validator: crossAppRelationTripleSchemaValidator,
      when: "triple schema has no source type",
      value: without(tripleWithRelationType, "sourceType"),
      path: [],
    },
    {
      validator: crossAppNodeValidator,
      when: "node has no core title",
      value: without(node, "coreTitle"),
      path: ["coreTitle"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node created date has no offset",
      value: { ...node, createdAt: "2026-06-12T14:00:00" },
      path: ["createdAt"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node created date is a number",
      value: { ...node, createdAt: 1749736800000 },
      path: ["createdAt"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node has no direct content",
      value: { ...node, content: { full: nodeFull } },
      path: ["content", "direct"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node direct content has an unknown scale",
      value: {
        ...node,
        content: { ...nodeContent, direct: { ...nodeDirect, scale: "page" } },
      },
      path: ["content", "direct", "scale"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node direct content has an unknown embedding model",
      value: {
        ...node,
        content: {
          ...nodeContent,
          direct: {
            ...nodeDirect,
            embedding: { value: [0.1], embedding: "unknown-model" },
          },
        },
      },
      path: ["content", "direct", "embedding", "embedding"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node embedding vector holds a string",
      value: {
        ...node,
        content: {
          ...nodeContent,
          direct: { ...nodeDirect, embedding: { value: ["0.1"] } },
        },
      },
      path: ["content", "direct", "embedding", "value", 0],
    },
    {
      validator: crossAppNodeValidator,
      when: "node full content has no content type",
      value: {
        ...node,
        content: { ...nodeContent, full: without(nodeFull, "contentType") },
      },
      path: ["content", "full", "contentType"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node full content has an unsupported content type",
      value: {
        ...node,
        content: {
          ...nodeContent,
          full: { ...nodeFull, contentType: "text/html" },
        },
      },
      path: ["content", "full", "contentType"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node content has a key the contract does not define",
      value: { ...node, content: { ...nodeContent, summary: { value: "x" } } },
      path: ["content"],
    },
    {
      validator: crossAppNodeValidator,
      when: "node asset has no content hash",
      value: { ...node, assets: [{ sourceRef: "attachments/a.png" }] },
      path: ["assets", 0, "contentHash"],
    },
    {
      validator: crossAppRelationValidator,
      when: "relation has no destination",
      value: without(relation, "destination"),
      path: ["destination"],
    },
    {
      validator: crossAppRelationValidator,
      when: "relation source is not a string",
      value: { ...toJson(relation), source: 42 },
      path: ["source"],
    },
    {
      validator: crossAppRelationValidator,
      when: "relation rid is not a RID",
      value: { ...toJson(relation), rid: "relation-1" },
      path: ["rid"],
    },
    {
      validator: crossAppRelationValidator,
      when: "relation is not an object",
      value: [toJson(relation)],
      path: [],
    },
  ])("refuses JSON where the $when", ({ validator, value, path }) => {
    const result = validator.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(path);
  });
});
