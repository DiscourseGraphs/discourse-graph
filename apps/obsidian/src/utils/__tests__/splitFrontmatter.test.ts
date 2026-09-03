import { describe, expect, it } from "vitest";
import { splitFrontmatter } from "~/utils/splitFrontmatter";

describe("splitFrontmatter", () => {
  it("splits a standard block", () => {
    expect(splitFrontmatter("---\na: 1\nb: two\n---\nbody here")).toEqual({
      yaml: "a: 1\nb: two",
      body: "body here",
    });
  });

  it("handles CRLF line endings", () => {
    expect(splitFrontmatter("---\r\na: 1\r\n---\r\nbody")).toEqual({
      yaml: "a: 1",
      body: "body",
    });
  });

  it("treats an empty block as present but empty", () => {
    expect(splitFrontmatter("---\n---\nbody")).toEqual({
      yaml: "",
      body: "body",
    });
  });

  it("returns no frontmatter when the file does not start with a fence", () => {
    const content = "intro text\n---\na: 1\n---\nbody";
    expect(splitFrontmatter(content)).toEqual({ yaml: null, body: content });
  });

  it("leaves a horizontal rule in the body alone", () => {
    expect(splitFrontmatter("---\na: 1\n---\nbody\n---\nafter rule")).toEqual({
      yaml: "a: 1",
      body: "body\n---\nafter rule",
    });
  });

  it("handles a file that is only frontmatter", () => {
    expect(splitFrontmatter("---\na: 1\n---")).toEqual({
      yaml: "a: 1",
      body: "",
    });
  });

  it("returns no frontmatter for content with no fence at all", () => {
    expect(splitFrontmatter("just a note")).toEqual({
      yaml: null,
      body: "just a note",
    });
  });

  it("keeps multi-line YAML values intact", () => {
    expect(splitFrontmatter("---\ntags:\n  - a\n  - b\n---\nbody")).toEqual({
      yaml: "tags:\n  - a\n  - b",
      body: "body",
    });
  });
});
