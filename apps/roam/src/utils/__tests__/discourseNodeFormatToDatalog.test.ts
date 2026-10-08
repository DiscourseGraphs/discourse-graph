import { describe, expect, it, vi } from "vitest";
import type { DatalogFnExpr } from "roamjs-components/types/native";

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import discourseNodeFormatToDatalog from "~/utils/discourseNodeFormatToDatalog";

describe("discourseNodeFormatToDatalog", () => {
  it("keeps a format's escaped metacharacters through the re-pattern string", () => {
    const clauses = discourseNodeFormatToDatalog({
      freeVar: "node",
      text: "Claim",
      type: "clm",
      shortcut: "C",
      specification: [],
      backedBy: "user",
      canvasSettings: {},
      format: "Claim (draft) - {content}",
    });
    const pattern = clauses.find(
      (clause): clause is DatalogFnExpr =>
        clause.type === "fn-expr" && clause.fn === "re-pattern",
    )?.arguments[0]?.value;
    expect(pattern).toBeDefined();
    // Roam reads the query as EDN, whose string literals escape backslashes
    // and quotes the way JSON strings do.
    const titleRegex = new RegExp(String(JSON.parse(pattern ?? "")));

    expect(titleRegex.test("Claim (draft) - sleep")).toBe(true);
    expect(titleRegex.test("Claim draft - sleep")).toBe(false);
  });
});
