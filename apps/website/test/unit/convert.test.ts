import { describe, expect, it } from "vitest";
import { renderNodeBody } from "../../app/utils/conversion/convert";

describe("published Markdown", () => {
  it("omits Obsidian properties from the reader", () => {
    expect(
      renderNodeBody("---\nprivate: value\n---\nSome *body* text.", "Obsidian"),
    ).toBe("<p>Some <em>body</em> text.</p>");
  });
  it("keeps ordinary links from Roam Markdown", () => {
    expect(renderNodeBody("[Source](https://example.org)", "Roam")).toContain(
      'href="https://example.org"',
    );
  });
});
