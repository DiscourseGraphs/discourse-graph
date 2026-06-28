import { describe, it, expect } from "vitest";
import { markdownToRoamBlocks } from "../markdownToRoamBlocks";

describe("markdownToRoamBlocks", () => {
  it("drops leading YAML frontmatter", () => {
    expect(
      markdownToRoamBlocks("---\nnodeTypeId: evd-1\n---\n\n# Title\n\nbody"),
    ).toEqual([{ text: "Title", heading: 1 }, { text: "body" }]);
  });

  it("maps ATX headings to Roam heading blocks, clamped to 3", () => {
    expect(markdownToRoamBlocks("# A\n## B\n### C\n#### D")).toEqual([
      { text: "A", heading: 1 },
      { text: "B", heading: 2 },
      { text: "C", heading: 3 },
      { text: "D", heading: 3 },
    ]);
  });

  it("does not treat #tag or empty headings as headings", () => {
    expect(markdownToRoamBlocks("#tag is a ref\n#")).toEqual([
      { text: "#tag is a ref" },
      { text: "#" },
    ]);
  });

  it("nests list items by indentation", () => {
    expect(markdownToRoamBlocks("- a\n  - b\n  - c\n- d")).toEqual([
      { text: "a", children: [{ text: "b" }, { text: "c" }] },
      { text: "d" },
    ]);
  });

  it("supports ordered lists and tab indentation", () => {
    expect(markdownToRoamBlocks("1. one\n\t2. two")).toEqual([
      { text: "one", children: [{ text: "two" }] },
    ]);
  });

  it("treats each non-list line as its own top-level block", () => {
    expect(markdownToRoamBlocks("para one\npara two")).toEqual([
      { text: "para one" },
      { text: "para two" },
    ]);
  });

  it("resets list nesting after a blank line or heading", () => {
    expect(markdownToRoamBlocks("- a\n  - b\n\n- c")).toEqual([
      { text: "a", children: [{ text: "b" }] },
      { text: "c" },
    ]);
  });

  it("returns [] for empty or frontmatter-only input", () => {
    expect(markdownToRoamBlocks("")).toEqual([]);
    expect(markdownToRoamBlocks("---\na: 1\n---\n")).toEqual([]);
  });

  it("parses the Obsidian-origin full markdown example", () => {
    const md =
      "---\nnodeTypeId: evd-7c1f9a2b\nnodeInstanceId: 0192f1a0\n---\n\n# REM sleep correlates with recall\n\nParticipants with more REM sleep showed better next-day recall.\n";
    expect(markdownToRoamBlocks(md)).toEqual([
      { text: "REM sleep correlates with recall", heading: 1 },
      {
        text: "Participants with more REM sleep showed better next-day recall.",
      },
    ]);
  });

  it("parses Roam-origin full markdown (H1 + paragraph + bullet)", () => {
    const md =
      "# Sleep improves memory consolidation\n\nMultiple studies show that sleep after learning strengthens memory traces.\n\n- Supported by [[EVD]] - Rasch & Born 2013\n";
    expect(markdownToRoamBlocks(md)).toEqual([
      { text: "Sleep improves memory consolidation", heading: 1 },
      {
        text: "Multiple studies show that sleep after learning strengthens memory traces.",
      },
      { text: "Supported by [[EVD]] - Rasch & Born 2013" },
    ]);
  });
});
