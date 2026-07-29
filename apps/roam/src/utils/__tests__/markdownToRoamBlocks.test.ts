import { describe, expect, it } from "vitest";
import { markdownToRoamBlocks } from "~/utils/markdownToRoamBlocks";

describe("markdownToRoamBlocks", () => {
  it("strips YAML frontmatter and splits paragraphs on blank lines", () => {
    expect(
      markdownToRoamBlocks(
        [
          "---",
          "nodeTypeId: claim",
          "nodeInstanceId: node-1",
          "---",
          "",
          "First paragraph line one",
          "line two",
          "",
          "Second paragraph",
        ].join("\n"),
      ),
    ).toEqual([
      { text: "First paragraph line one\nline two", children: [] },
      { text: "Second paragraph", children: [] },
    ]);
  });

  it("nests content under headings by heading level", () => {
    expect(
      markdownToRoamBlocks(
        ["# Top", "intro", "## Sub", "detail", "# Next", "tail"].join("\n"),
      ),
    ).toEqual([
      {
        text: "Top",
        heading: 1,
        children: [
          { text: "intro", children: [] },
          {
            text: "Sub",
            heading: 2,
            children: [{ text: "detail", children: [] }],
          },
        ],
      },
      {
        text: "Next",
        heading: 1,
        children: [{ text: "tail", children: [] }],
      },
    ]);
  });

  it("clamps headings deeper than Roam's maximum but keeps their nesting depth", () => {
    expect(
      markdownToRoamBlocks(["### Three", "#### Four", "text"].join("\n")),
    ).toEqual([
      {
        text: "Three",
        heading: 3,
        children: [
          {
            text: "Four",
            heading: 3,
            children: [{ text: "text", children: [] }],
          },
        ],
      },
    ]);
  });

  it("nests list items by indentation and strips list markers", () => {
    expect(
      markdownToRoamBlocks(
        [
          "- parent",
          "  - child",
          "    - grandchild",
          "- sibling",
          "1. ordered",
        ].join("\n"),
      ),
    ).toEqual([
      {
        text: "parent",
        children: [
          {
            text: "child",
            children: [{ text: "grandchild", children: [] }],
          },
        ],
      },
      { text: "sibling", children: [] },
      { text: "ordered", children: [] },
    ]);
  });

  it("keeps a loose list nested after blank lines between items", () => {
    expect(
      markdownToRoamBlocks(["- parent", "", "  - child"].join("\n")),
    ).toEqual([
      {
        text: "parent",
        children: [{ text: "child", children: [] }],
      },
    ]);
  });

  it("nests tab-indented list items", () => {
    expect(markdownToRoamBlocks(["- parent", "\t- child"].join("\n"))).toEqual([
      {
        text: "parent",
        children: [{ text: "child", children: [] }],
      },
    ]);
  });

  it("keeps a fenced code block as a single block, including blank lines", () => {
    expect(
      markdownToRoamBlocks(
        ["```js", "const a = 1;", "", "const b = 2;", "```"].join("\n"),
      ),
    ).toEqual([
      {
        text: "```js\nconst a = 1;\n\nconst b = 2;\n```",
        children: [],
      },
    ]);
  });

  it("keeps an unclosed fence as a single block through the end of input", () => {
    expect(markdownToRoamBlocks(["```", "code", "more"].join("\n"))).toEqual([
      { text: "```\ncode\nmore", children: [] },
    ]);
  });

  it("returns no blocks for empty or frontmatter-only markdown", () => {
    expect(markdownToRoamBlocks("")).toEqual([]);
    expect(
      markdownToRoamBlocks(["---", "nodeTypeId: claim", "---"].join("\n")),
    ).toEqual([]);
  });

  it("treats an unclosed frontmatter delimiter as content", () => {
    expect(markdownToRoamBlocks(["---", "not frontmatter"].join("\n"))).toEqual(
      [{ text: "---\nnot frontmatter", children: [] }],
    );
  });

  it("handles CRLF line endings", () => {
    expect(markdownToRoamBlocks("# Title\r\ntext\r\n")).toEqual([
      {
        text: "Title",
        heading: 1,
        children: [{ text: "text", children: [] }],
      },
    ]);
  });
});
