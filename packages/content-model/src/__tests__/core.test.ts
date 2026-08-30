import { describe, expect, it } from "vitest";

import {
  createDelimitedInlineRule,
  parseInlineText,
  renderInlineText,
  replaceTextRange,
  sortInlineAnnotationsForRender,
  type DgInlineAnnotation,
} from "@repo/content-model";

const renderer = {
  open: (annotation: DgInlineAnnotation): string => `<${annotation.type}>`,
  close: (annotation: DgInlineAnnotation): string => `</${annotation.type}>`,
};

describe("inline parser core", () => {
  it("parses nested delimiter rules without retaining syntax characters", () => {
    const parsed = parseInlineText({
      source: "**bold and _italic_**",
      rules: [
        createDelimitedInlineRule({ delimiter: "**", type: "bold" }),
        createDelimitedInlineRule({ delimiter: "_", type: "italic" }),
      ],
    });

    expect(parsed.text).toBe("bold and italic");
    expect(parsed.annotations).toEqual([
      { type: "italic", start: 9, end: 15 },
      { type: "bold", start: 0, end: 15 },
    ]);
  });
});

describe("inline annotation rendering", () => {
  it("uses stable ordering for annotations with the same span", () => {
    const annotations: DgInlineAnnotation[] = [
      { type: "italic", start: 0, end: 4 },
      { type: "bold", start: 0, end: 4 },
    ];

    expect(sortInlineAnnotationsForRender({ annotations })).toEqual([
      { type: "bold", start: 0, end: 4 },
      { type: "italic", start: 0, end: 4 },
    ]);
  });

  it("keeps nested annotations open across interior boundaries", () => {
    expect(
      renderInlineText({
        value: {
          text: "abcd",
          annotations: [
            { type: "bold", start: 0, end: 4 },
            { type: "italic", start: 1, end: 3 },
          ],
        },
        renderer,
      }),
    ).toBe("<bold>a<italic>bc</italic>d</bold>");
  });

  it("closes and reopens partially overlapping annotations", () => {
    expect(
      renderInlineText({
        value: {
          text: "abcdef",
          annotations: [
            { type: "bold", start: 0, end: 4 },
            { type: "italic", start: 2, end: 6 },
          ],
        },
        renderer,
      }),
    ).toBe("<bold>ab<italic>cd</italic></bold><italic>ef</italic>");
  });
});

describe("replaceTextRange", () => {
  it("updates enclosing and following annotation offsets", () => {
    expect(
      replaceTextRange({
        value: {
          text: "one two three",
          annotations: [
            { type: "bold", start: 0, end: 7 },
            { type: "italic", start: 8, end: 13 },
            { type: "inline-code", start: 4, end: 7 },
          ],
        },
        range: { start: 4, end: 7 },
        replacement: "second",
      }),
    ).toEqual({
      text: "one second three",
      annotations: [
        { type: "bold", start: 0, end: 10 },
        { type: "italic", start: 11, end: 16 },
      ],
    });
  });
});
