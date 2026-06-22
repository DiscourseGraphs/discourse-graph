import assert from "node:assert/strict";
import test from "node:test";
import { fromObsidianMarkdown, toObsidianMarkdown } from "./index";
import { validateDgDocument } from "../../validate";

void test("converts Obsidian Markdown to a valid DgDocument", () => {
  const document = fromObsidianMarkdown({
    title: "Claim",
    markdown:
      "- A **bold** claim\n  - Child with [[Target|alias]]\n1. Numbered [link](https://example.com)\n```ts\nconst x = 1;\n```",
  });
  assert.equal(validateDgDocument(document).valid, true);
  assert.ok(
    document.body.annotations.some(
      (annotation) =>
        annotation.type === "reference" &&
        annotation.attributes.kind === "obsidian-wikilink",
    ),
  );
  assert.ok(
    document.body.annotations.some((annotation) => annotation.type === "code"),
  );
});

void test("renders Obsidian Markdown from canonical blocks", () => {
  const document = fromObsidianMarkdown({
    title: "Claim",
    markdown: "- A **bold** claim\n  - Child with [[Target|alias]]",
  });
  assert.equal(
    toObsidianMarkdown(document),
    "- A **bold** claim\n  - Child with [[Target|alias]]",
  );
});
