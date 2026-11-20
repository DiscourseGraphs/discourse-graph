import { describe, expect, it } from "vitest";
import { splitFrontmatter } from "~/utils/splitFrontmatter";

describe("splitFrontmatter", () => {
  it("splits a standard block", () => {
    expect(splitFrontmatter("---\na: 1\n---\nbody\n")).toEqual({
      yaml: "a: 1",
      body: "body\n",
    });
  });

  it("handles CRLF line endings", () => {
    expect(splitFrontmatter("---\r\na: 1\r\n---\r\nbody")).toEqual({
      yaml: "a: 1",
      body: "body",
    });
  });

  it("reports an empty block as empty yaml, not as absent", () => {
    expect(splitFrontmatter("---\n---\nbody")).toEqual({
      yaml: "",
      body: "body",
    });
  });

  it("returns null yaml when the file has no block", () => {
    expect(splitFrontmatter("just body\n")).toEqual({
      yaml: null,
      body: "just body\n",
    });
  });

  it("leaves a horizontal rule in the body alone", () => {
    const content = "intro\n\n---\n\nafter the rule\n";
    expect(splitFrontmatter(content)).toEqual({ yaml: null, body: content });
  });

  it("treats a file that is only frontmatter as having an empty body", () => {
    expect(splitFrontmatter("---\na: 1\n---\n")).toEqual({
      yaml: "a: 1",
      body: "",
    });
  });

  it("keeps multi-line yaml values intact", () => {
    const { yaml } = splitFrontmatter(
      "---\ntags:\n  - one\n  - two\n---\nbody",
    );
    expect(yaml).toBe("tags:\n  - one\n  - two");
  });

  it("tolerates trailing spaces on the fences", () => {
    expect(splitFrontmatter("--- \na: 1\n--- \nbody")).toEqual({
      yaml: "a: 1",
      body: "body",
    });
  });

  it("ignores a block that does not start at the first character", () => {
    const content = "\n---\na: 1\n---\nbody";
    expect(splitFrontmatter(content)).toEqual({ yaml: null, body: content });
  });
});
