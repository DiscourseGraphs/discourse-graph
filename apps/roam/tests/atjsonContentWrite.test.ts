/* eslint-disable @typescript-eslint/naming-convention */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  DG_ATJSON_CONTENT_TYPE,
  TEXT_MARKDOWN_CONTENT_TYPE,
  TEXT_PLAIN_CONTENT_TYPE,
  derivePlainTextFromDgDocument,
  type DgDocument,
} from "@repo/content-model";
import { splitEmbeddableContentNodes } from "../src/utils/contentEmbeddingSplit";
import {
  convertRoamNodeToLocalContent,
  upsertNodesToSupabaseAsContentWithEmbeddings,
} from "../src/utils/upsertNodesAsContentWithEmbeddings";

const readAppSource = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const createEmbeddingResponse = (input: string[]): Response =>
  new Response(
    JSON.stringify({
      data: input.map(() => ({ embedding: Array(1536).fill(0) })),
    }),
    {
      status: 200,
      headers: new Headers([["Content-Type", "application/json"]]),
    },
  );

void test("Roam writer uploads ATJSON without embedding serialized content", async () => {
  const originalFetch = globalThis.fetch;
  const globals = globalThis as { window?: unknown };
  const originalWindow = globals.window;
  const embeddingInputs: string[][] = [];
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    void url;
    const body = JSON.parse(String(init?.body ?? "{}")) as { input: string[] };
    embeddingInputs.push(body.input);
    return Promise.resolve(createEmbeddingResponse(body.input));
  }) as typeof fetch;
  globals.window = {
    roamAlphaAPI: {
      pull: () => ({
        ":block/string": "Human readable **claim**",
        ":block/uid": "node-1",
        ":block/order": 0,
        ":block/children": [
          {
            ":block/string": "Nested [[Evidence]]",
            ":block/uid": "child-1",
            ":block/order": 0,
          },
        ],
      }),
    },
  };

  const uploadedRows: Array<Record<string, unknown>> = [];
  const supabaseClient = {
    rpc: (name: string, args: { data: Array<Record<string, unknown>> }) => {
      void name;
      uploadedRows.push(...args.data);
      return Promise.resolve({ error: null });
    },
  };

  try {
    await upsertNodesToSupabaseAsContentWithEmbeddings(
      [
        {
          author_local_id: "user-1",
          author_name: "User One",
          source_local_id: "node-1",
          created: "2026-01-01T00:00:00.000Z",
          last_modified: "2026-01-02T00:00:00.000Z",
          node_title: "Claim note",
          text: "Human readable **claim**",
          type: "claim",
        },
      ],
      supabaseClient as never,
      { spaceId: 1, userId: 2 } as never,
    );
  } finally {
    globalThis.fetch = originalFetch;
    globals.window = originalWindow;
  }

  assert.deepEqual(embeddingInputs, [["Claim note Human readable **claim**"]]);
  assert.equal(uploadedRows.length, 2);

  const plain = uploadedRows.find(
    (row) => row.content_type === TEXT_PLAIN_CONTENT_TYPE,
  );
  const atjson = uploadedRows.find(
    (row) => row.content_type === DG_ATJSON_CONTENT_TYPE,
  );

  assert.equal(plain?.variant, "direct_and_description");
  assert.equal(plain?.text, "Claim note Human readable **claim**");
  assert.ok(plain?.embedding_inline);

  assert.equal(atjson?.variant, "full");
  assert.equal(typeof atjson?.text, "string");
  assert.match(atjson.text as string, /Nested/);
  assert.equal((atjson.text as string).includes("{"), false);
  assert.equal(atjson.embedding_inline, undefined);
  const content = (atjson.metadata as { content: DgDocument }).content;
  assert.equal(content.version, "dg-content-model/v1");
  assert.equal(atjson.text, derivePlainTextFromDgDocument(content));
  assert.ok(
    content.body.annotations.some(
      (annotation) =>
        annotation.type === "block" &&
        annotation.attributes.blockId === "child-1" &&
        annotation.attributes.depth === 1,
    ),
  );
});

void test("Roam embedding split keeps non-plain rows out of embedding batches", () => {
  const { embeddableContentNodes, nonEmbeddableContentNodes } =
    splitEmbeddableContentNodes([
      { content_type: TEXT_PLAIN_CONTENT_TYPE, text: "plain" },
      { content_type: TEXT_MARKDOWN_CONTENT_TYPE, text: "markdown" },
      { content_type: DG_ATJSON_CONTENT_TYPE, text: "derived" },
      { text: "legacy plain default" },
    ]);

  assert.deepEqual(
    embeddableContentNodes.map((node) => node.text),
    ["plain", "legacy plain default"],
  );
  assert.deepEqual(
    nonEmbeddableContentNodes.map((node) => node.content_type),
    [TEXT_MARKDOWN_CONTENT_TYPE, DG_ATJSON_CONTENT_TYPE],
  );
});

void test("Roam text fallback preserves existing plain row and derived ATJSON", () => {
  const globals = globalThis as { window?: unknown };
  const originalWindow = globals.window;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  globals.window = {};
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const rows = convertRoamNodeToLocalContent({
      nodes: [
        {
          author_local_id: "user-1",
          author_name: "User One",
          source_local_id: "block-1",
          created: "2026-01-01T00:00:00.000Z",
          last_modified: "2026-01-02T00:00:00.000Z",
          text: "Block-backed claim",
          type: "claim",
        },
      ],
    });

    assert.equal(warnings.length, 1);
    assert.equal(rows.length, 2);

    const plain = rows.find(
      (row) => row.content_type === TEXT_PLAIN_CONTENT_TYPE,
    );
    const atjson = rows.find(
      (row) => row.content_type === DG_ATJSON_CONTENT_TYPE,
    );
    assert.equal(plain?.variant, "direct");
    assert.equal(plain?.text, "Block-backed claim");
    assert.equal(atjson?.variant, "full");
    assert.equal(atjson?.text, "Block-backed claim");
    assert.equal((atjson?.text ?? "").includes("{"), false);
    const content = (atjson?.metadata as { content: DgDocument }).content;
    assert.equal(content.title.text, "Block-backed claim");
    assert.equal(content.body.text, "");
    assert.equal(atjson?.text, derivePlainTextFromDgDocument(content));
  } finally {
    console.warn = originalWarn;
    globals.window = originalWindow;
  }
});

void test("Roam sync and cleanup paths keep ATJSON out of plain-row behavior", () => {
  const syncSource = readAppSource("src/utils/syncDgNodesToSupabase.ts");
  const cleanupSource = readAppSource("src/utils/cleanupOrphanedNodes.ts");

  assert.match(syncSource, /splitEmbeddableContentNodes/);
  assert.match(
    syncSource,
    /\.\.\.nodesWithEmbeddings, \.\.\.nonEmbeddableContent/,
  );
  assert.match(
    cleanupSource,
    /\.eq\("content_type", TEXT_PLAIN_CONTENT_TYPE\)/,
  );
});
