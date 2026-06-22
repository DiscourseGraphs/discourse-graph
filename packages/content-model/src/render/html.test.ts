import assert from "node:assert/strict";
import test from "node:test";
import { fromObsidianMarkdown } from "../adapters/obsidian";
import { toHtml } from "./html";

void test("renders representative title and body documents to HTML", () => {
  const document = fromObsidianMarkdown({
    title: "A **claim**",
    markdown: "- Body with [link](https://example.com)",
  });
  assert.equal(
    toHtml(document),
    '<article><h1>A <strong>claim</strong></h1><li data-block-id="obsidian-block-1">Body with <a href="https://example.com">link</a></li></article>',
  );
});
