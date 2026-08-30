import { describe, expect, it } from "vitest";

import {
  obsidianMarkdownToDgDocument,
  renderDgDocumentToHtml,
  type DgDocument,
} from "@repo/content-model";

describe("package HTML renderer", () => {
  it("renders representative title and body structures", () => {
    const document = obsidianMarkdownToDgDocument({
      title: "Renderer example",
      markdown: `# Renderer example

Paragraph with **bold**, [link](https://example.com), and ![diagram](asset.png).

- First
  - Nested

\`\`\`ts
const value = 1;
\`\`\``,
    });

    expect(renderDgDocumentToHtml({ document })).toBe(
      '<article class="dg-document"><h1>Renderer example</h1>' +
        '<p>Paragraph with <strong>bold</strong>, <a href="https://example.com">link</a>, and <img src="asset.png" alt="diagram">.</p>' +
        "<ul><li>First<ul><li>Nested</li></ul></li></ul>" +
        '<pre><code class="language-ts">const value = 1;</code></pre></article>',
    );
  });

  it("escapes text and rejects executable URLs", () => {
    const document: DgDocument = {
      version: 1,
      title: { text: "<Unsafe>", annotations: [] },
      body: {
        text: "click",
        annotations: [
          { type: "link", href: "javascript:alert(1)", start: 0, end: 5 },
          {
            type: "block",
            id: "paragraph",
            blockType: "paragraph",
            start: 0,
            end: 5,
          },
        ],
      },
    };

    expect(renderDgDocumentToHtml({ document })).toContain(
      '<h1>&lt;Unsafe&gt;</h1><p><a href="#">click</a></p>',
    );
  });
});
