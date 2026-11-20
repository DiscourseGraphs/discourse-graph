import { describe, it, expect } from "vitest";
import {
  convert,
  splitFrontmatter,
  toWebViewHtml,
} from "../../app/utils/conversion/convert";
import { sanitizeHtml } from "../../app/utils/conversion/sanitizeHtml";

const NOTE = `---
nodeTypeId: node_G_B1s5HQk0MoI5JpI9Ui9
nodeInstanceId: 01a11c81
---
Some *body* text.`;

const YAML_BLOCK = `<pre class="frontmatter"><code class="language-yaml">nodeTypeId: node_G_B1s5HQk0MoI5JpI9Ui9
nodeInstanceId: 01a11c81</code></pre>`;

const PROPERTIES = `<details class="frontmatter"><summary>Properties</summary>${YAML_BLOCK}</details>
`;

describe("splitFrontmatter", () => {
  it("separates a leading YAML block from the body", () => {
    expect(splitFrontmatter(NOTE)).toEqual({
      frontmatter:
        "nodeTypeId: node_G_B1s5HQk0MoI5JpI9Ui9\nnodeInstanceId: 01a11c81",
      body: "Some *body* text.",
    });
  });

  it("handles a frontmatter-only note", () => {
    expect(splitFrontmatter("---\na: 1\n---\n")).toEqual({
      frontmatter: "a: 1",
      body: "",
    });
    expect(splitFrontmatter("---\na: 1\n---")).toEqual({
      frontmatter: "a: 1",
      body: "",
    });
  });

  it("leaves text without leading frontmatter alone", () => {
    expect(splitFrontmatter("Intro\n---\na: 1\n---\n")).toEqual({
      body: "Intro\n---\na: 1\n---\n",
    });
  });
});

describe("convert", () => {
  it("renders Obsidian frontmatter as a plain YAML block", () => {
    expect(convert(NOTE, "obsidian", "html")).toBe(
      `${YAML_BLOCK}\n<p>Some <em>body</em> text.</p>`,
    );
  });

  it("folds the frontmatter away for web views", () => {
    expect(toWebViewHtml({ text: NOTE, source: "obsidian" })).toBe(
      `${PROPERTIES}<p>Some <em>body</em> text.</p>`,
    );
  });

  it("escapes markup inside the frontmatter", () => {
    const html = convert("---\nx: <script>\n---\n", "obsidian", "html");
    expect(html).toContain("x: &lt;script&gt;");
  });

  it("keeps the properties block through sanitizing", () => {
    expect(sanitizeHtml(PROPERTIES)).toBe(PROPERTIES);
  });

  it("keeps the stored text for markdown formats", () => {
    expect(convert(NOTE, "obsidian", "markdown")).toBe(NOTE);
  });
});
