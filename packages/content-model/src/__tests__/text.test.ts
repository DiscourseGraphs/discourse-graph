import { describe, expect, it } from "vitest";
import {
  normalizeLineEndings,
  stripFrontmatter,
  stripTitleHeading,
  trimBlankLines,
} from "../text/index.js";

describe("normalizeLineEndings", () => {
  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeLineEndings("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });
});

describe("trimBlankLines", () => {
  it("removes surrounding blank lines but keeps line indentation", () => {
    expect(trimBlankLines("\n  \n    code\n  text\n\n  \n")).toBe(
      "    code\n  text",
    );
  });

  it("leaves a whitespace-only single line for the caller to judge", () => {
    expect(trimBlankLines("   ")).toBe("   ");
  });
});

describe("stripTitleHeading", () => {
  it("strips a title heading first line and following blank lines", () => {
    expect(
      stripTitleHeading({ markdown: "# Title\n\nbody", title: "Title" }),
    ).toBe("body");
  });

  it("leaves markdown whose first line differs from the title", () => {
    expect(
      stripTitleHeading({ markdown: "# Other\n\nbody", title: "Title" }),
    ).toBe("# Other\n\nbody");
  });

  it("requires an exact match, not a prefix", () => {
    expect(
      stripTitleHeading({ markdown: "# Title extra\nbody", title: "Title" }),
    ).toBe("# Title extra\nbody");
  });

  it("returns an empty string for heading-only markdown", () => {
    expect(stripTitleHeading({ markdown: "# Title", title: "Title" })).toBe("");
  });

  it("handles CRLF line endings", () => {
    expect(
      stripTitleHeading({ markdown: "# Title\r\nbody", title: "Title" }),
    ).toBe("body");
  });
});

describe("stripFrontmatter", () => {
  it("removes a leading YAML frontmatter block and following blank lines", () => {
    expect(
      stripFrontmatter(
        [
          "---",
          "nodeTypeId: claim",
          "nodeInstanceId: node-1",
          "---",
          "",
          "# Body",
        ].join("\n"),
      ),
    ).toBe("# Body");
  });

  it("handles CRLF frontmatter", () => {
    expect(stripFrontmatter("---\r\nkey: value\r\n---\r\nBody")).toBe("Body");
  });

  it("returns markdown unchanged when there is no frontmatter", () => {
    expect(stripFrontmatter("# Body\ntext")).toBe("# Body\ntext");
  });

  it("treats a delimiter that never closes as content", () => {
    expect(stripFrontmatter("---\nnot frontmatter")).toBe(
      "---\nnot frontmatter",
    );
  });

  it("does not treat a mid-document rule as frontmatter", () => {
    expect(stripFrontmatter("intro\n---\noutro")).toBe("intro\n---\noutro");
  });

  it("returns an empty string for frontmatter-only markdown", () => {
    expect(stripFrontmatter("---\nkey: value\n---\n")).toBe("");
  });
});
