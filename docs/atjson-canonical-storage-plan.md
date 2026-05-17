# ATJSON canonical storage plan

## Summary

Add ATJSON as the canonical stored content representation for Discourse Graphs without interrupting the current working Obsidian sink/import flow.

The important storage decision is:

- `variant` remains the semantic slice of a node, such as `direct`, `full`, or `direct_and_description`.
- `Content.content_type` becomes the representation format, such as `text/plain`, `text/markdown`, or `application/vnd.discourse-graph.atjson+json; version=1`.
- The first rollout writes ATJSON alongside the current text and Markdown rows. Existing readers keep using the current rows until the app renderers are ready.

This plan builds on `docs/atjson-port-plan.md`, but focuses on the storage and rollout path.

Use `docs/atjson-port-plan.md` as the architecture plan for the shared content-model package and adapters. Use this file as the database and rollout plan for storing canonical ATJSON without switching destination readers immediately.

## Reference source map

SamePage reference code exists locally under:

- `C:\Users\Michael\Desktop\Areas\RoamJS\SamePage Repos\samepage.network`
- `C:\Users\Michael\Desktop\Areas\RoamJS\SamePage Repos\roam-samepage`
- `C:\Users\Michael\Desktop\Areas\RoamJS\SamePage Repos\obsidian-samepage`

Files to port or adapt:

- `samepage.network/package/internal/types.ts`
  - Source for the original SamePage annotation schema, `SamePageSchema`, and ATJSON-compatible content/annotation shape.
- `samepage.network/package/utils/atJsonParser.ts`
  - Source for generic lexer/parser helpers, `createEmptyAtJson`, `createTextAtJson`, and `combineAtJsons`.
- `samepage.network/package/utils/renderAtJson.ts`
  - Source for generic annotation rendering order and prefix/suffix application.
- `roam-samepage/src/utils/blockParser.ts`
  - Roam block text to SamePage ATJSON parser.
- `roam-samepage/src/utils/encodeState.ts`
  - Roam page/tree to SamePage state encoder. This is the strongest reference for Roam-native ATJSON creation.
- `roam-samepage/src/utils/atJsonToRoam.ts`
  - SamePage ATJSON to Roam string renderer. Keep as later renderer reference, not part of the first write-only storage pass.
- `roam-samepage/src/utils/decodeState.ts`
  - SamePage state to Roam page/block materializer. Keep as later destination-render reference.
- `obsidian-samepage/src/utils/leafParser.ts`
  - Obsidian Markdown to SamePage ATJSON parser.
- `obsidian-samepage/src/utils/atJsonToObsidian.ts`
  - SamePage ATJSON to Obsidian Markdown renderer. Keep as later renderer reference.
- `roam-samepage/tests/blockGrammar.test.ts` and `obsidian-samepage/tests/leafParser.test.ts`
  - Source fixtures for parser and round-trip behavior.

Current Discourse Graphs code paths to preserve:

- `packages/database/supabase/schemas/content.sql`
  - Defines `Content`, `ContentVariant`, `my_contents`, `content_local_input`, and `upsert_content`.
- `packages/database/schema.yaml`
  - LinkML source, currently stale around `ContentVariant` because SQL/generated types already include `full`.
- `packages/database/src/dbTypes.ts`
  - Generated Supabase types used by both apps.
- `apps/obsidian/src/utils/upsertNodesAsContentWithEmbeddings.ts`
  - Current Obsidian writer. Writes `direct` title rows and `full` Markdown rows.
- `apps/obsidian/src/utils/importNodes.ts`
  - Current Obsidian import reader. Requires `direct` and `full`; must remain Markdown-based during write-only rollout.
- `apps/roam/src/utils/upsertNodesAsContentWithEmbeddings.ts`
  - Current Roam writer. Writes `direct` or `direct_and_description` text rows.
- `apps/roam/src/utils/pageToMarkdown.ts`
  - Current Roam Markdown export reference.

## Data model changes

Add a representation discriminator to `Content`:

```sql
content_type text not null default 'text/plain'
```

Use these initial content types:

- `text/plain`
  - Plain searchable title or combined text.
- `text/markdown`
  - Native Markdown representation used by the current Obsidian import path.
- `application/vnd.discourse-graph.atjson+json; version=1`
  - DG canonical ATJSON representation. The structured document is stored in `Content.metadata`, and `Content.text` stores a derived plain-text projection.

For ATJSON rows, use this row shape:

```ts
{
  variant: "full",
  content_type: DG_ATJSON_CONTENT_TYPE,
  text: derivePlainTextFromDgDocument(document),
  metadata: {
    content: document,
  },
}
```

Do not serialize the ATJSON document into `Content.text`. `Content.text` should remain useful for search, previews, duplicate detection, and any existing text-centered tooling.

Update the uniqueness model:

```sql
unique (space_id, source_local_id, variant, content_type)
```

This prevents the new `full` ATJSON row from replacing the existing `full` Markdown row.

`FileReference` currently points at `Content(space_id, source_local_id, variant)` for the `full` row. When the content uniqueness key changes, `FileReference` must also distinguish representation:

- add a generated `content_type` column with value `text/markdown`
- update the foreign key to `Content(space_id, source_local_id, variant, content_type)`
- keep file references attached to the current Markdown `full` row until asset handling is intentionally moved to ATJSON

Backfill existing rows:

- Existing `variant = 'full'` rows become `content_type = 'text/markdown'`.
- All other existing rows become `content_type = 'text/plain'`.

Update these database surfaces:

- `Content` table
- `my_contents` view
- `my_contents_with_embedding_openai_text_embedding_3_small_1536` view
- `FileReference` foreign key
- `content_local_input`
- `_local_content_to_db_content`
- `upsert_content`
- generated database types

Do not add a new `ContentVariant` for ATJSON. ATJSON is a representation, not a semantic slice.

Define shared constants instead of repeating raw strings:

```ts
export const TEXT_PLAIN_CONTENT_TYPE = "text/plain";
export const TEXT_MARKDOWN_CONTENT_TYPE = "text/markdown";
export const DG_ATJSON_CONTENT_TYPE =
  "application/vnd.discourse-graph.atjson+json; version=1";
```

## Canonical model package

Create `packages/content-model` with package name `@repo/content-model`.

The package should own a DG-specific document model rather than adopting SamePage's schema exactly:

```ts
type DgDocument = {
  version: "dg-content-model/v1";
  title: TextDocument;
  body: BodyDocument;
  metadata?: JsonObject;
};
```

The canonical model should include:

- top-level `title` and `body`
- inline annotations for title
- body block annotations with explicit block identity and parent linkage
- typed references for Roam pages, Roam blocks, and Obsidian wikilinks
- `appAttributes` only as a fidelity escape hatch

Port first:

- shared parser helper ideas from SamePage
- Obsidian Markdown to DG document conversion
- Roam page/block tree to DG document conversion
- validators for spans, title/body rules, block parents, and reference attributes

Defer until after write-only storage:

- DG document to Obsidian Markdown rendering
- DG document to Roam page/block rendering
- destination import reads from ATJSON
- HTML rendering

## Write-only rollout

### Database first

Implement the `content_type` schema change and make sure all current readers still see the same rows they expect.

Migration order:

1. Add `Content.content_type text not null default 'text/plain'`.
2. Backfill existing `variant = 'full'` rows to `content_type = 'text/markdown'`.
3. Add generated `FileReference.content_type = 'text/markdown'`.
4. Replace `FileReference`'s three-column content foreign key with a four-column foreign key.
5. Replace `content_space_local_id_variant_idx` with a unique index over `(space_id, source_local_id, variant, content_type)`.
6. Add `content_type` to `content_local_input`.
7. Update `_local_content_to_db_content` and `upsert_content` to read, insert, update, and conflict on `content_type`.
8. Regenerate database types.
9. Update current app queries to filter by expected `content_type`.
10. Enable ATJSON writes.

Every current query that relies on `direct` or `full` should be explicit about representation:

- discovery/title rows: `variant = 'direct'` and `content_type = 'text/plain'`
- Obsidian import body rows: `variant = 'full'` and `content_type = 'text/markdown'`
- ATJSON rows: `variant = 'full'` and `content_type = 'application/vnd.discourse-graph.atjson+json; version=1`

### Obsidian write path

Update `apps/obsidian/src/utils/upsertNodesAsContentWithEmbeddings.ts` so content changes write:

- `direct/text/plain`
- `full/text/markdown`
- `full/application/vnd.discourse-graph.atjson+json; version=1`

For the ATJSON row, store the `DgDocument` in `metadata.content` and store a derived plain-text projection in `text`.

Keep embeddings only on intentional searchable text rows. Do not embed serialized ATJSON. If ATJSON rows are embedded later, embed their derived `text` projection, not the JSON payload.

### Roam write path

Update Roam sync so it keeps current text rows and adds:

- `full/application/vnd.discourse-graph.atjson+json; version=1`

Use Roam-native page/block structure as the source, following SamePage `encodeState.ts` rather than deriving canonical ATJSON from Markdown.

For the ATJSON row, store the `DgDocument` in `metadata.content` and store a derived plain-text projection in `text`.

If cross-app Markdown import remains active before ATJSON renderers are ready, Roam should also emit `full/text/markdown` for shared nodes or route shared extraction through a source-neutral reader that can provide that Markdown row. Do not make Obsidian depend on Roam-origin ATJSON until the ATJSON-to-Obsidian renderer is active.

### Readers stay stable

During this phase:

- Obsidian import continues to materialize Markdown from `full/text/markdown`.
- Obsidian publish and asset handling continue unchanged.
- Roam sync continues its five-minute local-to-remote process.
- No destination app should prefer ATJSON until renderer parity is tested.

## Later conversion rollout

After ATJSON write coverage is stable:

1. Port `atJsonToObsidian` into a DG document renderer.
2. Add tests showing DG ATJSON renders to equivalent Obsidian Markdown for representative nodes.
3. Add an Obsidian importer fallback order:
   - prefer ATJSON only when renderer tests pass and source row exists
   - fall back to `full/text/markdown`
4. Port `atJsonToRoam` and `decodeState` concepts into a Roam renderer/materializer.
5. Add Roam destination import from DG ATJSON.
6. Only after both destination paths are stable, decide whether Markdown remains a durable native export or becomes derived output.

## Test plan

Database tests:

- `content_type` defaults to `text/plain`.
- Backfill maps existing `full` rows to `text/markdown`.
- `upsert_content` allows two rows with the same `(space_id, source_local_id, variant)` when `content_type` differs.
- `my_contents` includes `content_type`.
- `FileReference` still cascades from the Markdown `full` content row.
- ATJSON rows store the canonical document in `metadata.content`.
- ATJSON rows store derived searchable text in `text`, not serialized JSON.
- Embedding views continue to work for text rows.

Content-model package tests:

- valid and invalid spans
- invalid block parents
- title rejects block annotations
- Roam page refs versus block refs
- Obsidian wikilinks and aliases
- parser fixtures ported from SamePage Roam and Obsidian tests

App regression tests:

- Obsidian import still fetches `direct/text/plain` and `full/text/markdown`.
- Obsidian sync writes ATJSON rows without changing current Markdown rows.
- Roam sync writes ATJSON rows without removing or replacing current text rows.
- Serialized ATJSON is never stored in `Content.text` or sent for embeddings.

Manual validation:

- Existing Obsidian publish/import flow still works before and after ATJSON rows are present.
- Existing Roam local-to-remote sync still completes.
- Published Obsidian nodes remain importable by current Obsidian importer.

## Assumptions

- `variant` is the semantic slice, not the representation.
- `content_type` is the representation discriminator.
- ATJSON payloads live in `Content.metadata.content`.
- `Content.text` on ATJSON rows is a derived plain-text projection.
- DG canonical model should be `DgDocument`, not SamePage's exact `SamePageSchema`.
- Initial ATJSON rollout is write-only.
- The current database generated types must be regenerated after schema changes.
- `packages/database/schema.yaml` should be reconciled with SQL because it currently omits the already-existing `full` content variant.
