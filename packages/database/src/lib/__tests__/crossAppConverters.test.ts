import { describe, expect, it } from "vitest";
import type {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
  CrossAppRelationTypeSchema,
} from "../../crossAppContracts";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppNodeToDbContent,
  crossAppRelationToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
  crossAppRelationTypeSchemaToDbConcept,
} from "../crossAppConverters";

const baseSchema: CrossAppNodeSchema = {
  localId: "concept-1",
  rid: "orn:obsidian.schema:vault-a/concept-1",
  createdAt: new Date("2026-06-14T11:00:00Z"),
  authorId: "account-local-1",
  label: "Some concept",
};

const baseNode: CrossAppNode = {
  localId: "node-1",
  rid: "orn:obsidian.note:vault-a/node-1",
  createdAt: new Date("2026-06-14T11:00:00Z"),
  authorId: "account-local-1",
  nodeType: "concept-1",
  coreTitle: "REM sleep and recall",
  content: { direct: { value: "EVD - REM sleep and recall" } },
};

describe("crossAppNodeSchemaToDbConcept", () => {
  it("maps format to literal_content.format", () => {
    const concept = crossAppNodeSchemaToDbConcept({
      ...baseSchema,
      format: "[[CLM]] - {content}",
    });
    expect(concept.literal_content).toEqual({
      label: "Some concept",
      format: "[[CLM]] - {content}",
    });
  });

  it("keeps the template keys alongside format", () => {
    const concept = crossAppNodeSchemaToDbConcept({
      ...baseSchema,
      format: "[[CLM]] - {content}",
      template: "* Evidence\n",
      templateTitle: "Claim template",
    });
    expect(concept.literal_content).toEqual({
      label: "Some concept",
      format: "[[CLM]] - {content}",
      template: "Claim template",
      template_content: "* Evidence\n",
    });
  });

  it("writes the label into literal_content as well as the name", () => {
    const concept = crossAppNodeSchemaToDbConcept(baseSchema);
    expect(concept.name).toBe("Some concept");
    expect(concept.literal_content).toEqual({ label: "Some concept" });
  });

  it("stores slot definitions as roles plus local reference content", () => {
    const result = crossAppNodeSchemaToDbConcept({
      ...baseSchema,
      templateTitle: "Template Title",
      slotDefinitions: { evidence: "evidence-type", claim: "claim-type" },
    });
    expect(result.literal_content).toEqual({
      label: "Some concept",
      template: "Template Title",
      roles: ["evidence", "claim"],
    });
    expect(result.local_reference_content).toEqual({
      evidence: "evidence-type",
      claim: "claim-type",
    });
  });

  it("omits roles and reference content when there are no slot definitions", () => {
    const result = crossAppNodeSchemaToDbConcept({
      ...baseSchema,
      slotDefinitions: {},
    });
    expect(result.literal_content).toEqual({ label: "Some concept" });
    expect(result).not.toHaveProperty("local_reference_content");
  });
});

describe("crossAppNodeToDbConcept", () => {
  it("stores node slots as local reference content", () => {
    expect(
      crossAppNodeToDbConcept({
        ...baseNode,
        slots: { evidence: "node-5" },
      }).local_reference_content,
    ).toEqual({ evidence: "node-5" });
  });

  it("omits reference content when the node has no slots", () => {
    expect(crossAppNodeToDbConcept(baseNode)).not.toHaveProperty(
      "local_reference_content",
    );
  });

  it("writes the description as a direct_and_description content beside direct", () => {
    const concept = crossAppNodeToDbConcept({
      ...baseNode,
      content: {
        direct: { value: "EVD - REM sleep and recall" },
        directAndDescription: {
          value: "EVD - REM sleep and recall Subjects recalled more",
          authorId: "account-local-2",
        },
      },
    });
    expect(concept.name).toBe("EVD - REM sleep and recall");
    expect(
      concept.contents_inline?.map(({ variant, text, author_local_id }) => ({
        variant,
        text,
        author_local_id,
      })),
    ).toEqual([
      {
        variant: "direct",
        text: "EVD - REM sleep and recall",
        author_local_id: "account-local-1",
      },
      {
        variant: "direct_and_description",
        text: "EVD - REM sleep and recall Subjects recalled more",
        author_local_id: "account-local-2",
      },
    ]);
  });

  it("writes only the direct content when the node has no description", () => {
    expect(
      crossAppNodeToDbConcept(baseNode).contents_inline?.map(
        ({ variant }) => variant,
      ),
    ).toEqual(["direct"]);
  });
});

describe("an item without modifiedAt", () => {
  const CREATED = "2026-06-14T11:00:00.000Z";
  const relationType: CrossAppRelationTypeSchema = {
    localId: "supports",
    createdAt: new Date(CREATED),
    authorId: "account-local-1",
    label: "supports",
    complement: "is supported by",
  };
  const triple: CrossAppRelationTripleSchema = {
    localId: "node-supports-concept",
    createdAt: new Date(CREATED),
    authorId: "account-local-1",
    label: "supports",
    complement: "is supported by",
    sourceType: "concept-1",
    destinationType: "concept-1",
  };
  const relation: CrossAppRelation = {
    localId: "relation-1",
    createdAt: new Date(CREATED),
    authorId: "account-local-1",
    relationType: "node-supports-concept",
    source: "node-2",
    destination: "node-1",
  };

  it.each([
    {
      converter: "crossAppNodeSchemaToDbConcept",
      convert: () => crossAppNodeSchemaToDbConcept(baseSchema),
    },
    {
      converter: "crossAppNodeToDbConcept",
      convert: () => crossAppNodeToDbConcept(baseNode),
    },
    {
      converter: "crossAppRelationTypeSchemaToDbConcept",
      convert: () => crossAppRelationTypeSchemaToDbConcept(relationType),
    },
    {
      converter: "crossAppRelationTripleSchemaToDbConcept",
      convert: () => crossAppRelationTripleSchemaToDbConcept(triple),
    },
    {
      converter: "crossAppRelationToDbConcept",
      convert: () => crossAppRelationToDbConcept(relation),
    },
  ])("$converter writes its createdAt as last_modified", ({ convert }) => {
    expect(convert()).toMatchObject({
      created: CREATED,
      last_modified: CREATED,
    });
  });

  it("crossAppNodeToDbContent writes the content's own createdAt as last_modified", () => {
    const content = crossAppNodeToDbContent(
      {
        ...baseNode,
        content: {
          direct: {
            value: "EVD - REM sleep and recall",
            createdAt: new Date("2026-06-15T09:00:00Z"),
          },
        },
      },
      "direct",
    );
    expect(content).toMatchObject({
      created: "2026-06-15T09:00:00.000Z",
      last_modified: "2026-06-15T09:00:00.000Z",
    });
  });
});
