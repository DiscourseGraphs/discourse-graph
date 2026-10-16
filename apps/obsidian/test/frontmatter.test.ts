import { describe, expect, it } from "vitest";
import { parseTestNote, serializeTestNote } from "./frontmatter";

describe("test note frontmatter", () => {
  it("keeps an unquoted date as a string", () => {
    expect(parseTestNote("---\ncreated: 2026-08-07\n---\nbody")).toEqual({
      frontmatter: { created: "2026-08-07" },
      body: "body",
    });
  });

  it("treats invalid YAML as absent while preserving the body", () => {
    expect(parseTestNote("---\na: [unclosed\n---\nbody")).toEqual({
      frontmatter: {},
      body: "body",
    });
  });

  it.each(["body", "---\nnodeTypeId: source-type\n---\nbody"])(
    "does not retain mutated metadata when reading the same text again: %s",
    (content) => {
      parseTestNote(content).frontmatter.nodeInstanceId = "ghost-id";
      expect(parseTestNote(content).frontmatter).not.toHaveProperty(
        "nodeInstanceId",
      );
    },
  );

  it("serializes fixture metadata without changing the body", () => {
    const note = serializeTestNote("body\n", {
      nodeInstanceId: "source",
      created: "2026-08-07",
      publishedToGroups: ["group"],
    });
    expect(parseTestNote(note)).toEqual({
      frontmatter: {
        nodeInstanceId: "source",
        created: "2026-08-07",
        publishedToGroups: ["group"],
      },
      body: "body\n",
    });
  });
});
