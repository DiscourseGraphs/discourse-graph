import { describe, expect, it } from "vitest";
import type { ListItemCache, Pos, SectionCache } from "obsidian";
import {
  locateTaggedLine,
  renderedLineText,
  sectionsMatchText,
} from "~/utils/taggedLineLocator";

const pos = (
  startLine: number,
  endLine: number,
  startOffset = startLine,
): Pos => ({
  start: { line: startLine, col: 0, offset: startOffset },
  end: { line: endLine, col: 1, offset: startOffset + 1 },
});

const section = (
  type: string,
  startLine: number,
  endLine = startLine,
): SectionCache => ({ type, position: pos(startLine, endLine) });

const item = (startLine: number, endLine = startLine): ListItemCache => ({
  parent: -1,
  position: pos(startLine, endLine),
});

describe("locateTaggedLine", () => {
  const sections = [
    section("yaml", 0, 2),
    section("heading", 3),
    section("paragraph", 4, 6),
    section("footnoteDefinition", 7),
    section("list", 8, 12),
    section("table", 14, 17),
  ];
  const listItems = [item(8, 9), item(10), item(11, 12)];

  it("counts frontmatter as a block and skips footnote definitions", () => {
    expect(locateTaggedLine({ sections, listItems, line: 3 })).toEqual({
      blockIndex: 1,
      blockCount: 5,
    });
    expect(locateTaggedLine({ sections, listItems, line: 8 })?.blockIndex).toBe(
      3,
    );
  });

  it("targets the whole block for a line inside a multi-line paragraph", () => {
    expect(locateTaggedLine({ sections, listItems, line: 5 })).toEqual({
      blockIndex: 2,
      blockCount: 5,
    });
  });

  it("skips zero-width sections at the end of the file", () => {
    const eof = { line: 18, col: 0, offset: 500 };
    const withTrailing: SectionCache[] = [
      ...sections,
      { type: "text", position: { start: eof, end: eof } },
    ];
    expect(
      locateTaggedLine({ sections: withTrailing, listItems, line: 3 })
        ?.blockCount,
    ).toBe(5);
  });

  it("picks the list item whose range covers the line, including continuations", () => {
    expect(locateTaggedLine({ sections, listItems, line: 9 })?.item).toEqual({
      kind: "li",
      index: 0,
      count: 3,
    });
    expect(locateTaggedLine({ sections, listItems, line: 12 })?.item).toEqual({
      kind: "li",
      index: 2,
      count: 3,
    });
  });

  it("picks the innermost item when a parent's range spans a nested one", () => {
    const nested = [item(8, 12), item(10), item(11)];
    expect(
      locateTaggedLine({ sections, listItems: nested, line: 10 })?.item?.index,
    ).toBe(1);
  });

  it("ignores list items outside the section", () => {
    const withOther = [item(0), ...listItems];
    expect(
      locateTaggedLine({ sections, listItems: withOther, line: 10 })?.item,
    ).toEqual({ kind: "li", index: 1, count: 3 });
  });

  it("maps table lines to rows, skipping the separator line", () => {
    const at = (line: number): ReturnType<typeof locateTaggedLine> =>
      locateTaggedLine({ sections, listItems, line });
    expect(at(14)?.item).toEqual({ kind: "tr", index: 0, count: 3 });
    expect(at(15)?.item).toBeUndefined();
    expect(at(17)?.item).toEqual({ kind: "tr", index: 2, count: 3 });
  });

  it("returns null for a line in no rendered block", () => {
    expect(locateTaggedLine({ sections, listItems, line: 7 })).toBeNull();
    expect(locateTaggedLine({ sections, listItems, line: 13 })).toBeNull();
  });
});

describe("renderedLineText", () => {
  it("drops block and list markers but keeps tags", () => {
    expect(renderedLineText("## Heading #clm")).toBe("Heading #clm");
    expect(renderedLineText("  - [x] done #clm")).toBe("done #clm");
    expect(renderedLineText("> 1. quoted #clm")).toBe("quoted #clm");
  });

  it("shows wikilinks and markdown links as their display text", () => {
    expect(
      renderedLineText("See [[Some note|alias text]] and [[Other]] #clm"),
    ).toBe("See alias text and Other #clm");
    expect(renderedLineText("A [site](https://x.io/a_b) link")).toBe(
      "A site link",
    );
  });

  it("drops embeds, footnote refs and comments", () => {
    expect(renderedLineText("Pic ![[img.png]] here[^1] %%hidden%% end")).toBe(
      "Pic here end",
    );
  });

  it("strips emphasis, highlight and strikethrough markers", () => {
    expect(
      renderedLineText("**bold** __b2__ *it* _it2_ ==hl== ~~gone~~ #clm"),
    ).toBe("bold b2 it it2 hl gone #clm");
  });

  it("keeps intraword underscores", () => {
    expect(renderedLineText("use snake_case_name here")).toBe(
      "use snake_case_name here",
    );
  });

  it("keeps inline code content verbatim", () => {
    expect(renderedLineText("Run `a **b** [[c]]` now")).toBe(
      "Run a **b** [[c]] now",
    );
  });
});

describe("renderedLineText for table rows", () => {
  it("joins the cells the way the rendered row reads", () => {
    expect(renderedLineText("| **Alpha** | owner | #clm |")).toBe(
      "Alpha owner #clm",
    );
    expect(renderedLineText("|  | b |")).toBe("b");
  });
});

describe("sectionsMatchText", () => {
  const text = "# Title\n\nfirst para\nsecond line\n";
  const at = (line: number, col: number, offset: number) => ({
    line,
    col,
    offset,
  });
  const fresh: SectionCache[] = [
    { type: "heading", position: { start: at(0, 0, 0), end: at(0, 7, 7) } },
    {
      type: "paragraph",
      position: { start: at(2, 0, 9), end: at(3, 11, 31) },
    },
  ];

  it("accepts sections whose offsets line up with the text", () => {
    expect(sectionsMatchText({ sections: fresh, text })).toBe(true);
  });

  it("rejects sections from before an edit that shifted the text", () => {
    expect(sectionsMatchText({ sections: fresh, text: `Intro\n${text}` })).toBe(
      false,
    );
  });

  it("ignores empty EOF sections, whose offsets Obsidian reports one short", () => {
    const eof = at(4, 0, 32);
    const withEof: SectionCache[] = [
      ...fresh,
      { type: "text", position: { start: eof, end: eof } },
    ];
    expect(sectionsMatchText({ sections: withEof, text })).toBe(true);
  });

  it("rejects sections that point past the last line", () => {
    const beyond: SectionCache[] = [
      {
        type: "paragraph",
        position: { start: at(9, 0, 40), end: at(9, 1, 41) },
      },
    ];
    expect(sectionsMatchText({ sections: beyond, text })).toBe(false);
  });
});
