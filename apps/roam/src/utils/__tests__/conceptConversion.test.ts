import { describe, expect, it, vi } from "vitest";
import type { SupabaseContext } from "~/utils/supabaseContext";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { discourseNodeSchemaToLocalConcept } from "~/utils/conceptConversion";

const context = { spaceId: 42 } as SupabaseContext;

const claimSchema: DiscourseNode = {
  type: "schema-1",
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "[[CLM]] - {content}",
};

const stubRoamQuery = () => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      q: vi.fn().mockReturnValue([["author-1", "page-1", 1000, 2000]]),
    },
  };
};

describe("discourseNodeSchemaToLocalConcept", () => {
  it("writes label and format into literal_content", () => {
    stubRoamQuery();
    const concept = discourseNodeSchemaToLocalConcept(context, claimSchema);
    expect(concept.literal_content).toEqual({
      label: "Claim",
      format: "[[CLM]] - {content}",
    });
  });

  it("keeps label and format when the type has a template", () => {
    stubRoamQuery();
    const concept = discourseNodeSchemaToLocalConcept(context, {
      ...claimSchema,
      template: [{ text: "Evidence" }],
    });
    expect(concept.literal_content).toEqual({
      label: "Claim",
      format: "[[CLM]] - {content}",
      template: "* Evidence\n",
    });
  });
});
