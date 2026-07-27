import { describe, expect, it } from "vitest";

import { stripFrontmatter } from "@repo/content-model";

describe("stripFrontmatter", () => {
  it("removes an Obsidian frontmatter block and the blank lines after it", () => {
    expect(
      stripFrontmatter(
        [
          "---",
          "nodeTypeId: evidence-type-id",
          "nodeInstanceId: node-1",
          "publishedToGroups:",
          "  - group-a",
          "---",
          "",
          "# REM sleep correlates with recall",
          "",
          "Updated evidence.",
        ].join("\n"),
      ),
    ).toBe("# REM sleep correlates with recall\n\nUpdated evidence.");
  });

  it("removes an empty frontmatter block", () => {
    expect(stripFrontmatter("---\n---\nBody.")).toBe("Body.");
  });

  it("normalizes carriage returns before matching the delimiter", () => {
    expect(
      stripFrontmatter("---\r\nnodeInstanceId: node-1\r\n---\r\nBody."),
    ).toBe("Body.");
  });

  it("returns markdown that has no frontmatter unchanged", () => {
    expect(stripFrontmatter("# Heading\n\nBody.")).toBe("# Heading\n\nBody.");
  });

  it("keeps a horizontal rule that is not a frontmatter delimiter", () => {
    expect(stripFrontmatter("Body.\n\n---\n\nMore body.")).toBe(
      "Body.\n\n---\n\nMore body.",
    );
  });

  it("returns the document unchanged when the frontmatter block is unterminated", () => {
    expect(stripFrontmatter("---\nnodeInstanceId: node-1\nBody.")).toBe(
      "---\nnodeInstanceId: node-1\nBody.",
    );
  });

  it("returns an empty string for a frontmatter-only document", () => {
    expect(stripFrontmatter("---\nnodeInstanceId: node-1\n---\n")).toBe("");
  });
});
