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
import {
  OBSIDIAN_IMPORT_CONTENT_TYPES,
  getContentTypeForObsidianImportVariant,
  selectObsidianImportContentRows,
} from "../src/utils/importContentTypes";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "../src/utils/upsertNodesAsContentWithEmbeddings";

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

void test("Obsidian writer uploads ATJSON without embedding serialized content", async () => {
  const originalFetch = globalThis.fetch;
  const embeddingInputs: string[][] = [];
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    void url;
    const body = JSON.parse(String(init?.body ?? "{}")) as { input: string[] };
    embeddingInputs.push(body.input);
    return Promise.resolve(createEmbeddingResponse(body.input));
  }) as typeof fetch;

  const uploadedRows: Array<Record<string, unknown>> = [];
  const supabaseClient = {
    rpc: (name: string, args: { data: Array<Record<string, unknown>> }) => {
      void name;
      uploadedRows.push(...args.data);
      return Promise.resolve({ error: null });
    },
  };
  const file = {
    basename: "Claim note",
    path: "Claim note.md",
  };
  const plugin = {
    app: {
      vault: {
        read: () =>
          Promise.resolve(
            "---\nnodeTypeId: claim\n---\n- **Human readable** [[Evidence]]",
          ),
      },
    },
  };

  try {
    await upsertNodesToSupabaseAsContentWithEmbeddings({
      obsidianNodes: [
        {
          file,
          frontmatter: { nodeTypeId: "claim" },
          nodeTypeId: "claim",
          nodeInstanceId: "node-1",
          created: "2026-01-01T00:00:00.000Z",
          last_modified: "2026-01-02T00:00:00.000Z",
          changeTypes: ["title", "content"],
        },
      ] as never,
      supabaseClient: supabaseClient as never,
      context: { spaceId: 1, userId: 2 } as never,
      accountLocalId: "user-1",
      plugin: plugin as never,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(embeddingInputs, [["Claim note"]]);
  assert.equal(uploadedRows.length, 3);

  const direct = uploadedRows.find(
    (row) => row.content_type === TEXT_PLAIN_CONTENT_TYPE,
  );
  const markdown = uploadedRows.find(
    (row) => row.content_type === TEXT_MARKDOWN_CONTENT_TYPE,
  );
  const atjson = uploadedRows.find(
    (row) => row.content_type === DG_ATJSON_CONTENT_TYPE,
  );

  assert.equal(direct?.variant, "direct");
  assert.equal(direct?.text, "Claim note");
  assert.ok(direct?.embedding_inline);

  assert.equal(markdown?.variant, "full");
  assert.equal(typeof markdown?.text, "string");
  assert.match(markdown.text as string, /Human readable/);
  assert.equal(markdown.embedding_inline, undefined);

  assert.equal(atjson?.variant, "full");
  assert.equal(typeof atjson?.text, "string");
  assert.equal((atjson.text as string).includes("{"), false);
  assert.equal(atjson.embedding_inline, undefined);
  const content = (atjson.metadata as { content: DgDocument }).content;
  assert.equal(content.version, "dg-content-model/v1");
  assert.equal(atjson.text, derivePlainTextFromDgDocument(content));
});

void test("Obsidian title-only changes refresh ATJSON title", async () => {
  const originalFetch = globalThis.fetch;
  const embeddingInputs: string[][] = [];
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    void url;
    const body = JSON.parse(String(init?.body ?? "{}")) as { input: string[] };
    embeddingInputs.push(body.input);
    return Promise.resolve(createEmbeddingResponse(body.input));
  }) as typeof fetch;

  const uploadedRows: Array<Record<string, unknown>> = [];
  const supabaseClient = {
    rpc: (name: string, args: { data: Array<Record<string, unknown>> }) => {
      void name;
      uploadedRows.push(...args.data);
      return Promise.resolve({ error: null });
    },
  };
  const plugin = {
    app: {
      vault: {
        read: () => Promise.resolve("Existing body"),
      },
    },
  };

  try {
    await upsertNodesToSupabaseAsContentWithEmbeddings({
      obsidianNodes: [
        {
          file: {
            basename: "Renamed claim",
            path: "Renamed claim.md",
          },
          frontmatter: { nodeTypeId: "claim" },
          nodeTypeId: "claim",
          nodeInstanceId: "node-1",
          created: "2026-01-01T00:00:00.000Z",
          last_modified: "2026-01-03T00:00:00.000Z",
          changeTypes: ["title"],
        },
      ] as never,
      supabaseClient: supabaseClient as never,
      context: { spaceId: 1, userId: 2 } as never,
      accountLocalId: "user-1",
      plugin: plugin as never,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(embeddingInputs, [["Renamed claim"]]);
  assert.equal(uploadedRows.length, 2);
  assert.equal(
    uploadedRows.some((row) => row.content_type === TEXT_MARKDOWN_CONTENT_TYPE),
    false,
  );

  const atjson = uploadedRows.find(
    (row) => row.content_type === DG_ATJSON_CONTENT_TYPE,
  );
  assert.equal(atjson?.text, "Renamed claim\n\nExisting body");
  const content = (atjson?.metadata as { content: DgDocument }).content;
  assert.equal(content.title.text, "Renamed claim");
  assert.equal(atjson?.text, derivePlainTextFromDgDocument(content));
});

void test("Obsidian content-only changes write body rows without embeddings", async () => {
  const originalFetch = globalThis.fetch;
  let embeddingRequestCount = 0;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    embeddingRequestCount += 1;
    return Promise.resolve(createEmbeddingResponse([]));
  }) as typeof fetch;

  const uploadedRows: Array<Record<string, unknown>> = [];
  const supabaseClient = {
    rpc: (name: string, args: { data: Array<Record<string, unknown>> }) => {
      void name;
      uploadedRows.push(...args.data);
      return Promise.resolve({ error: null });
    },
  };
  const plugin = {
    app: {
      vault: {
        read: () => Promise.resolve("Updated **body**"),
      },
    },
  };

  try {
    await upsertNodesToSupabaseAsContentWithEmbeddings({
      obsidianNodes: [
        {
          file: {
            basename: "Claim note",
            path: "Claim note.md",
          },
          frontmatter: { nodeTypeId: "claim" },
          nodeTypeId: "claim",
          nodeInstanceId: "node-1",
          created: "2026-01-01T00:00:00.000Z",
          last_modified: "2026-01-04T00:00:00.000Z",
          changeTypes: ["content"],
        },
      ] as never,
      supabaseClient: supabaseClient as never,
      context: { spaceId: 1, userId: 2 } as never,
      accountLocalId: "user-1",
      plugin: plugin as never,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(embeddingRequestCount, 0);
  assert.equal(uploadedRows.length, 2);
  assert.equal(
    uploadedRows.some((row) => row.content_type === TEXT_PLAIN_CONTENT_TYPE),
    false,
  );
  assert.ok(
    uploadedRows.some(
      (row) =>
        row.variant === "full" &&
        row.content_type === TEXT_MARKDOWN_CONTENT_TYPE &&
        row.text === "Updated **body**",
    ),
  );
  assert.ok(
    uploadedRows.some(
      (row) =>
        row.variant === "full" &&
        row.content_type === DG_ATJSON_CONTENT_TYPE &&
        row.embedding_inline === undefined,
    ),
  );
});

void test("Obsidian import stays on plain title and Markdown body rows", () => {
  assert.deepEqual(OBSIDIAN_IMPORT_CONTENT_TYPES, [
    TEXT_PLAIN_CONTENT_TYPE,
    TEXT_MARKDOWN_CONTENT_TYPE,
  ]);
  assert.equal(
    getContentTypeForObsidianImportVariant("direct"),
    TEXT_PLAIN_CONTENT_TYPE,
  );
  assert.equal(
    getContentTypeForObsidianImportVariant("full"),
    TEXT_MARKDOWN_CONTENT_TYPE,
  );

  const { direct, full } = selectObsidianImportContentRows([
    {
      variant: "full",
      content_type: DG_ATJSON_CONTENT_TYPE,
      text: "Derived ATJSON text",
    },
    {
      variant: "direct",
      content_type: TEXT_PLAIN_CONTENT_TYPE,
      text: "Claim note",
    },
    {
      variant: "full",
      content_type: TEXT_MARKDOWN_CONTENT_TYPE,
      text: "# Markdown body",
    },
  ]);

  assert.equal(direct?.text, "Claim note");
  assert.equal(full?.text, "# Markdown body");

  const legacyRows = selectObsidianImportContentRows([
    {
      variant: "direct",
      content_type: null,
      text: "Legacy claim",
    },
    {
      variant: "full",
      content_type: null,
      text: "Legacy Markdown body",
    },
  ]);

  assert.equal(legacyRows.direct?.text, "Legacy claim");
  assert.equal(legacyRows.full?.text, "Legacy Markdown body");
});

void test("Obsidian reader and publish paths stay on plain and Markdown rows", () => {
  const importNodesSource = readAppSource("src/utils/importNodes.ts");
  const publishNodeSource = readAppSource("src/utils/publishNode.ts");
  const syncSource = readAppSource("src/utils/syncDgNodesToSupabase.ts");

  assert.match(
    importNodesSource,
    /\.in\("content_type", OBSIDIAN_IMPORT_CONTENT_TYPES\)/,
  );
  assert.match(
    importNodesSource,
    /\.eq\("content_type", getContentTypeForObsidianImportVariant\(variant\)\)/,
  );
  assert.equal(importNodesSource.includes("DG_ATJSON_CONTENT_TYPE"), false);

  assert.match(
    publishNodeSource,
    /\.eq\("content_type", TEXT_MARKDOWN_CONTENT_TYPE\)/,
  );
  assert.match(
    syncSource,
    /\.in\("content_type", \[TEXT_PLAIN_CONTENT_TYPE, TEXT_MARKDOWN_CONTENT_TYPE\]\)/,
  );
  assert.match(syncSource, /\.eq\("content_type", TEXT_PLAIN_CONTENT_TYPE\)/);
});
