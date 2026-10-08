import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "~/utils/importNodes";

describe("parseFrontmatter", () => {
  it("reads the fields callers depend on", () => {
    const { frontmatter } = parseFrontmatter(
      "---\nnodeTypeId: 7f3a9c12-4b8e\nimportedFromRid: rid://abc-123\n---\nbody",
    );
    expect(frontmatter.nodeTypeId).toBe("7f3a9c12-4b8e");
    expect(frontmatter.importedFromRid).toBe("rid://abc-123");
  });

  it("returns empty frontmatter when the file has no block", () => {
    expect(parseFrontmatter("just body")).toEqual({
      frontmatter: {},
      body: "just body",
    });
  });

  // `gray-matter` threw here. Obsidian tolerates bad YAML, so the import keeps
  // going and the node type falls back to the one the import supplies.
  it("treats unparseable yaml as absent instead of throwing", () => {
    expect(() =>
      parseFrontmatter("---\na: [unclosed\n---\nbody"),
    ).not.toThrow();
    expect(
      parseFrontmatter("---\na: [unclosed\n---\nbody").frontmatter,
    ).toEqual({});
  });

  it("strips the block from the body it returns, even for bad yaml", () => {
    expect(parseFrontmatter("---\na: [unclosed\n---\nbody").body).toBe("body");
  });

  // Obsidian's parseYaml is the `yaml` package, so an unquoted date stays a
  // string. No caller reads a date field; this pins the engine's behaviour.
  it("leaves an unquoted date as a string", () => {
    expect(
      parseFrontmatter("---\ncreated: 2026-08-07\n---\n").frontmatter,
    ).toEqual({ created: "2026-08-07" });
  });
});
