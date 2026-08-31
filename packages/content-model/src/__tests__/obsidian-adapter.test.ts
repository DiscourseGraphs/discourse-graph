import { describe, expect, it } from "vitest";

import {
  dgDocumentToObsidianMarkdown,
  dgDocumentToPlainText,
  obsidianMarkdownToDgDocument,
  type DgBlockAnnotation,
  type DgReferenceAnnotation,
} from "@repo/content-model";

const fixture = `---
nodeInstanceId: node-1
---
# Example

Paragraph with **bold**, [a link](https://example.com), and [[Other Page|a page]].

- First item with ![[diagram.png|a diagram]]
  1. Nested item with \`inline code\`

\`\`\`ts
const answer = 42;
\`\`\``;

describe("Obsidian adapter", () => {
  it("parses representative Obsidian Markdown into canonical annotations", () => {
    const document = obsidianMarkdownToDgDocument({
      title: "Example",
      markdown: fixture,
    });
    const blocks = document.body.annotations.filter(
      (annotation): annotation is DgBlockAnnotation =>
        annotation.type === "block",
    );
    const references = document.body.annotations.filter(
      (annotation): annotation is DgReferenceAnnotation =>
        annotation.type === "reference",
    );

    expect(document.version).toBe(1);
    expect(document.title.text).toBe("Example");
    expect(document.body.text).toContain(
      "Paragraph with bold, a link, and a page.",
    );
    expect(document.body.text).not.toContain("**");
    expect(references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          referenceType: "page",
          target: "Other Page",
          label: "a page",
        }),
        expect.objectContaining({
          referenceType: "image",
          target: "diagram.png",
          label: "a diagram",
        }),
      ]),
    );
    expect(blocks.map((block) => block.blockType)).toEqual([
      "paragraph",
      "list-item",
      "list-item",
      "code-block",
    ]);
    expect(blocks[1]?.id).toBe("obsidian-block-1");
    expect(blocks[1]?.attributes).toMatchObject({
      depth: 0,
      listStyle: "bullet",
    });
    expect(blocks[2]?.parentId).toBe("obsidian-block-1");
    expect(blocks[2]?.attributes).toMatchObject({
      depth: 1,
      listStyle: "number",
    });
    expect(blocks[3]?.attributes?.language).toBe("ts");
  });

  it("renders the covered structures back to compatible Markdown", () => {
    const document = obsidianMarkdownToDgDocument({
      title: "Example",
      markdown: fixture,
    });
    const rendered = dgDocumentToObsidianMarkdown({ document });

    expect(rendered).toContain("# Example");
    expect(rendered).toContain("**bold**");
    expect(rendered).toContain("[a link](https://example.com)");
    expect(rendered).toContain("[[Other Page|a page]]");
    expect(rendered).toContain("![[diagram.png|a diagram]]");
    expect(rendered).toContain("  1. Nested item with `inline code`");
    expect(rendered).toContain("```ts\nconst answer = 42;\n```");
    expect(dgDocumentToPlainText({ document })).toContain(
      "Example\n\nParagraph with bold, a link, and a page.",
    );
    expect(dgDocumentToPlainText({ document })).not.toContain("[[");
  });
});
