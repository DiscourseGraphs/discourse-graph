import assert from "node:assert/strict";
import test from "node:test";
import { parseInlineText } from "./parser";
import { renderAnnotatedText } from "./render";
import type { InlineAnnotation } from "../schema";

void test("parses nested links, wikilinks, images, and formatting markers", () => {
  const parsed = parseInlineText(
    "**Bold** links to [DG](https://discoursegraphs.com), [[Note|alias]], ![alt](image.png), and ((abc123xyz)).",
  );
  assert.equal(parsed.text, "Bold links to DG, alias, alt, and abc123xyz.");
  assert.ok(
    parsed.annotations.some((annotation) => annotation.type === "bold"),
  );
  assert.ok(
    parsed.annotations.some((annotation) => annotation.type === "link"),
  );
  assert.ok(
    parsed.annotations.some(
      (annotation) =>
        annotation.type === "reference" &&
        annotation.attributes.kind === "obsidian-wikilink",
    ),
  );
  assert.ok(
    parsed.annotations.some((annotation) => annotation.type === "image"),
  );
  assert.ok(
    parsed.annotations.some(
      (annotation) =>
        annotation.type === "reference" &&
        annotation.attributes.kind === "roam-block",
    ),
  );
});

void test("renders wider annotations before nested annotations", () => {
  const annotations: InlineAnnotation[] = [
    {
      type: "bold",
      start: 0,
      end: 11,
    },
    {
      type: "italics",
      start: 6,
      end: 11,
    },
  ];
  const rendered = renderAnnotatedText({
    text: "hello world",
    annotations,
    renderers: {
      bold: { prefix: "**", suffix: "**" },
      italics: { prefix: "_", suffix: "_" },
    },
  });
  assert.equal(rendered, "**hello _world_**");
});
