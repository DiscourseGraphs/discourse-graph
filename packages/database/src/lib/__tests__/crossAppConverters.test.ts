import { describe, expect, it } from "vitest";
import { crossAppNodeSchemaToDbConcept } from "../crossAppConverters";
import type { CrossAppNodeSchema } from "../../crossAppContracts";

const baseSchema: CrossAppNodeSchema = {
  localId: "schema-1",
  label: "Claim",
  authorId: "author-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
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
});
