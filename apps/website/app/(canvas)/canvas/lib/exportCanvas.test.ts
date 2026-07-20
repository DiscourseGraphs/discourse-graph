import { describe, expect, it } from "vitest";
import { formatCanvasExport, type CanvasExport } from "./exportCanvas";

const canvas: CanvasExport = {
  nodes: [
    { id: "evidence", text: "A replicated result", type: "evidence" },
    { id: "claim", text: "The intervention works", type: "claim" },
  ],
  relations: [
    {
      fromId: "evidence",
      label: "Supports",
      toId: "claim",
    },
  ],
};

describe("formatCanvasExport", () => {
  it("formats Roam-compatible node tags and relations", () => {
    expect(formatCanvasExport({ canvas, target: "roam" })).toBe(
      [
        "- [[EVD]] - A replicated result",
        "  - Supports:: [[CLM]] - The intervention works",
        "- [[CLM]] - The intervention works",
      ].join("\n"),
    );
  });

  it("formats readable Obsidian markdown", () => {
    expect(formatCanvasExport({ canvas, target: "obsidian" })).toBe(
      [
        "- **Evidence:** A replicated result",
        "  - Supports ? **Claim:** The intervention works",
        "- **Claim:** The intervention works",
      ].join("\n"),
    );
  });

  it("returns an empty string for an empty canvas", () => {
    expect(
      formatCanvasExport({
        canvas: { nodes: [], relations: [] },
        target: "roam",
      }),
    ).toBe("");
  });
});
