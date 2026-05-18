import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  DG_ATJSON_CONTENT_TYPE,
  createDgAtJsonMetadata,
  derivePlainTextFromDgDocument,
  dgDocumentToHtml,
  dgDocumentToObsidianMarkdown,
  dgDocumentToRoamBlocks,
  dgDocumentToRoamMarkdown,
  obsidianMarkdownToDgDocument,
  roamTreeToDgDocument,
  validateDgDocument,
} from "./index";

const readPackageSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readPackageSourceFiles(path);
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }
    return [path];
  });

void test("parses and renders representative Obsidian markdown", () => {
  const sourceMarkdown =
    "---\nnodeTypeId: claim\n---\n- **Bold claim** with [source](https://example.com)\n- Link to [[Other note|other]]\n";
  const document = obsidianMarkdownToDgDocument({
    title: "Claim note",
    markdown: sourceMarkdown,
  });

  const validation = validateDgDocument(document);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
  assert.equal(document.metadata?.source, "obsidian");
  const renderedMarkdown = dgDocumentToObsidianMarkdown(document);
  assert.equal(
    renderedMarkdown,
    "- **Bold claim** with [source](https://example.com)\n- Link to [[Other note|other]]",
  );
  const reparsed = obsidianMarkdownToDgDocument({
    title: "Claim note",
    markdown: renderedMarkdown,
  });
  assert.equal(
    derivePlainTextFromDgDocument(reparsed),
    derivePlainTextFromDgDocument(document),
  );
});

void test("round-trips richer Obsidian markdown fixtures", () => {
  const sourceMarkdown = [
    "First paragraph with ![diagram](attachments/diagram.png)",
    "",
    "1. Numbered [[Target#Heading|alias]]",
    "\t1. Nested `inline code`",
    "",
    "```ts",
    "const answer = 42;",
    "```",
  ].join("\n");
  const document = obsidianMarkdownToDgDocument({
    title: "Fixture note",
    markdown: sourceMarkdown,
  });

  const validation = validateDgDocument(document);
  assert.deepEqual(validation.errors, []);
  assert.equal(
    dgDocumentToObsidianMarkdown(document),
    [
      "First paragraph with ![diagram](attachments/diagram.png)",
      "",
      "1. Numbered [[Target#Heading|alias]]",
      "\t1. Nested `inline code`",
      "",
      "```ts",
      "const answer = 42;",
      "```",
    ].join("\n"),
  );
  assert.equal(
    derivePlainTextFromDgDocument(document),
    "Fixture note\n\nFirst paragraph with diagram\nNumbered alias\nNested inline code\nconst answer = 42;",
  );
});

void test("parses Roam tree, renders Roam markdown, and materializes blocks", () => {
  const document = roamTreeToDgDocument({
    title: "Roam page",
    pageUid: "page-uid",
    children: [
      {
        uid: "block-a",
        text: "A **claim** about [[Evidence]]",
        viewType: "bullet",
        children: [
          {
            uid: "block-b",
            text: "nested ((abc123def))",
            viewType: "numbered",
          },
        ],
      },
    ],
  });

  const validation = validateDgDocument(document);
  assert.equal(validation.valid, true);
  assert.equal(
    dgDocumentToRoamMarkdown(document),
    "- A **claim** about [[Evidence]]\n  1. nested ((abc123def))",
  );
  const blocks = dgDocumentToRoamBlocks(document);
  assert.equal(blocks[0]?.uid, "block-a");
  assert.equal(blocks[0]?.text, "A **claim** about [[Evidence]]");
  assert.equal(blocks[0]?.children[0]?.uid, "block-b");
  assert.equal(blocks[0]?.children[0]?.text, "nested ((abc123def))");
});

void test("renders richer Roam native tree fixtures", () => {
  const document = roamTreeToDgDocument({
    title: "Roam fixture",
    pageUid: "page-uid",
    children: [
      {
        uid: "block-a",
        text: "Image ![diagram](https://example.com/diagram.png) #Evidence",
        viewType: "bullet",
      },
      {
        uid: "block-b",
        text: "Use `inline code` and ((abc123def))",
        viewType: "document",
      },
    ],
  });

  assert.equal(validateDgDocument(document).valid, true);
  assert.equal(
    dgDocumentToRoamMarkdown(document),
    [
      "- Image ![diagram](https://example.com/diagram.png) [[Evidence]]",
      "Use `inline code` and ((abc123def))",
    ].join("\n"),
  );
  const blocks = dgDocumentToRoamBlocks(document);
  assert.deepEqual(blocks, [
    {
      uid: "block-a",
      text: "Image ![diagram](https://example.com/diagram.png) [[Evidence]]",
      viewType: "bullet",
      children: [],
    },
    {
      uid: "block-b",
      text: "Use `inline code` and ((abc123def))",
      viewType: "document",
      children: [],
    },
  ]);
});

void test("validates invalid spans and block parents", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "Invalid",
    markdown: "- body",
  });
  document.body.annotations.push({
    type: "bold",
    start: 10,
    end: 20,
  });
  document.body.annotations.push({
    type: "block",
    start: 0,
    end: 1,
    attributes: {
      blockId: "orphan",
      parentBlockId: "missing",
      depth: 1,
      viewType: "bullet",
    },
  });

  const validation = validateDgDocument(document);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("exceeds")));
  assert.ok(
    validation.errors.some((error) => error.includes("does not exist")),
  );
});

void test("validates runtime-invalid annotation shapes from JSON", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "Invalid JSON",
    markdown: "- body",
  });
  (
    document.title.annotations as unknown as Array<Record<string, unknown>>
  ).push({
    type: "block",
    start: 0,
    end: 1,
    attributes: {
      blockId: "title-block",
      depth: 0,
      viewType: "bullet",
    },
  });
  document.body.annotations.push({
    type: "reference",
    start: 0,
    end: 1,
    attributes: {
      kind: "roam-block",
      blockUid: "",
    },
  });
  (document.body.annotations as unknown as Array<Record<string, unknown>>).push(
    {
      type: "block",
      start: 0,
      end: 1,
      attributes: {
        blockId: "bad-view",
        depth: -1,
        viewType: "kanban",
      },
    },
  );

  const validation = validateDgDocument(document);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((error) =>
      error.includes("title cannot contain block annotations"),
    ),
  );
  assert.ok(
    validation.errors.some((error) => error.includes("missing blockUid")),
  );
  assert.ok(validation.errors.some((error) => error.includes("invalid depth")));
  assert.ok(
    validation.errors.some((error) => error.includes("invalid viewType")),
  );
});

void test("validates negative and zero spans, duplicate block ids, and unknown references", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "Invalid runtime shapes",
    markdown: "- body",
  });
  (document.body.annotations as unknown as Array<Record<string, unknown>>).push(
    {
      type: "bold",
      start: -1,
      end: 1,
    },
    {
      type: "italics",
      start: 0,
      end: 0,
    },
    {
      type: "reference",
      start: 0,
      end: 1,
      attributes: {
        kind: "external-note",
      },
    },
    {
      type: "block",
      start: 0,
      end: 1,
      attributes: {
        blockId: "obsidian-block-1",
        depth: 0,
        viewType: "bullet",
      },
    },
  );

  const validation = validateDgDocument(document);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((error) => error.includes("negative start")),
  );
  assert.ok(
    validation.errors.some((error) =>
      error.includes("zero or negative length"),
    ),
  );
  assert.ok(validation.errors.some((error) => error.includes("unknown kind")));
  assert.ok(
    validation.errors.some((error) => error.includes("duplicate blockId")),
  );
});

void test("stores canonical content in metadata and derives plain text", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "Storage",
    markdown: "- **Human readable**",
  });
  const text = derivePlainTextFromDgDocument(document);
  const metadata = createDgAtJsonMetadata({ document });

  assert.equal(DG_ATJSON_CONTENT_TYPE.includes("atjson"), true);
  assert.equal(text.includes("{"), false);
  assert.equal(metadata.content.version, "dg-content-model/v1");
});

void test("refuses to store invalid canonical content in metadata", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "Invalid storage",
    markdown: "- body",
  });
  document.body.annotations.push({
    type: "bold",
    start: 0,
    end: 50,
  });

  assert.throws(
    () => createDgAtJsonMetadata({ document }),
    /Invalid DG document/,
  );
});

void test("renders HTML from the canonical document", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "HTML & title",
    markdown: "- A & **B < C** [link](https://example.com)",
  });

  const html = dgDocumentToHtml(document);
  assert.match(html, /<article>/);
  assert.match(html, /HTML &amp; title/);
  assert.match(html, /A &amp; <strong>B &lt; C<\/strong>/);
  assert.match(html, /href="https:\/\/example.com"/);
});

void test("sanitizes unsafe HTML link and image URLs", () => {
  const document = obsidianMarkdownToDgDocument({
    title: "HTML safety",
    markdown: [
      "[unsafe link](javascript:alert(1))",
      "",
      "![unsafe image](javascript:alert(2))",
    ].join("\n"),
  });

  const html = dgDocumentToHtml(document);
  assert.equal(html.includes("javascript:"), false);
  assert.match(html, /<a href="#">unsafe link<\/a>/);
  assert.match(html, /<img src="#" alt="unsafe image" \/>/);
});

void test("content model stays independent from SamePage runtime dependencies", () => {
  const forbiddenRuntimeTerms = ["samepage", "automerge", "ipfs", "websocket"];

  const matches = readPackageSourceFiles(join(process.cwd(), "src")).flatMap(
    (path) => {
      const content = readFileSync(path, "utf8").toLowerCase();
      return forbiddenRuntimeTerms
        .filter((term) => content.includes(term))
        .map((term) => `${path}: ${term}`);
    },
  );

  assert.deepEqual(matches, []);
});
