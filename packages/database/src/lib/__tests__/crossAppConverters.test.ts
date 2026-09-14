import { describe, expect, it } from "vitest";
import type { CrossAppNode, CrossAppNodeSchema } from "../../crossAppContracts";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
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
      format: "[[CLM]] - {content}",
      template: "Claim template",
      template_content: "* Evidence\n",
    });
  });

  it("omits literal_content when no keys are set", () => {
    const concept = crossAppNodeSchemaToDbConcept(baseSchema);
    expect(concept.literal_content).toBeUndefined();
  });

  it("stores slot definitions as roles plus local reference content", () => {
    const result = crossAppNodeSchemaToDbConcept({
      ...baseSchema,
      templateTitle: "Template Title",
      slotDefinitions: { evidence: "evidence-type", claim: "claim-type" },
    });
    expect(result.literal_content).toEqual({
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
    expect(result).not.toHaveProperty("literal_content");
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
});
