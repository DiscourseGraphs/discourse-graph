# v0 content model: canonical ATJSON storage

## Sources of truth

- Authoritative scope: `docs/authoritative scoping doc.md`.
- Context transcript: `docs/transcript.md`.
- Supporting plans: `docs/atjson-canonical-storage-plan.md`, `docs/atjson-canonical-storage-scope.md`, `docs/atjson-port-plan.md`.
- If docs disagree, use `docs/authoritative scoping doc.md` first, then the transcript, then supporting plans.

## Linear project draft

**Project title:** v0 content model: canonical ATJSON storage

**Project summary:** Add `Content.content_type`, route content sync through Next.js, define a DG-owned content model, and write canonical ATJSON rows alongside existing native rows without changing current Obsidian import behavior.

## Related Linear project context

- Related project: [Push and pull nodes between Roam and Obsidian](https://linear.app/discourse-graphs/project/push-and-pull-nodes-between-roam-and-obsidian-49473d9eeb09).
- That project is the Markdown-first cross-app compatibility baseline. Its MVP0 explicitly treats canonical atJSON as v1 follow-on work, not an MVP0 blocker.
- This project owns the canonical atJSON storage/content-model work that can later replace Markdown as the cross-app content model.
- Cross-link only when the relationship materially helps implementation:
  - [ENG-1847](https://linear.app/discourse-graphs/issue/ENG-1847/define-shared-cross-app-node-content-contract): existing shared node contract for `direct` title, `full` Markdown body, stable origin identity, and cross-app fixtures.
  - [ENG-1848](https://linear.app/discourse-graphs/issue/ENG-1848/add-roam-full-markdown-content-variant-for-shared-nodes): Roam emits `full` Markdown for Obsidian-compatible import; ATJSON writes must not replace this baseline.
  - [ENG-1852](https://linear.app/discourse-graphs/issue/ENG-1852/keep-roam-shared-node-content-fresh-in-the-sync-loop): Roam shared-node content freshness; Roam ATJSON rows should eventually follow the same local-to-remote freshness model.
  - [ENG-1857](https://linear.app/discourse-graphs/issue/ENG-1857/validate-obsidian-importer-with-roam-origin-nodes): validates the current Obsidian importer against Roam-origin `direct`/`full` Markdown rows; use as native-reader compatibility context.
  - [ENG-1882](https://linear.app/discourse-graphs/issue/ENG-1882/document-mvp0-markdown-fidelity-limits-and-v1-atjson-handoff): handoff point from Markdown fidelity limits to canonical atJSON.
  - [ENG-1794](https://linear.app/discourse-graphs/issue/ENG-1794/atomic-upsert-of-concept-and-content): related database sequencing if content upsert work overlaps atomic Concept+Content upserts; this project should not take on that full scope unless intentionally pulled in.

## Linear ticket template

Every task below should be one Linear engineering ticket and one PR. Use this exact body structure:

```md
## Problem

- ...

## Solution

- ...

## Done When

- ...

## Out of Scope

- ...

## Notes

- ...
```

Keep each section to 1-3 short bullets. `Out of Scope` and `Notes` may be omitted only when genuinely empty. Do not put local repo-doc links in Linear tickets; pull any needed facts into the ticket body because Linear becomes the durable source. Linear issue links and durable external references are okay when they materially help implementation.

## Key interfaces

- `variant` remains the semantic slice; `content_type` becomes the representation discriminator.
- Add `Content.content_type text not null default 'text/plain'`.
- Update uniqueness and upsert conflict behavior to `(space_id, source_local_id, variant, content_type)`.
- Store DG ATJSON in `Content.metadata.content`; keep `Content.text` as derived plain text.
- Initial constants: `text/plain`, `text/markdown`, `text/roam+markdown`, `text/obsidian+markdown`, `application/roam+json`, `application/vnd.discourse-graph.atjson+json; version=1`.

## Milestone 1: Storage and no-op API hop

### 1. Add shared content type constants

```md
## Problem

- Content representation strings are repeated or implicit.
- App and database code need a shared vocabulary before storage changes land.

## Solution

- Add shared constants for supported content types.
- Export them from `@repo/content-model` or the smallest dependency-safe shared module.

## Done When

- Constants exist for text, Markdown, Roam/Obsidian Markdown, Roam JSON, and DG ATJSON.
- Touched code imports constants instead of repeating raw strings.

## Notes

- `content_type` is the representation discriminator; `variant` remains the semantic slice.
- Do not add an ATJSON-specific `ContentVariant`.
```

### 2. Add `Content.content_type` and backfill rows

```md
## Problem

- `Content.variant` mixes semantic slice with representation format.
- Existing rows do not declare whether their `text` is plain text or Markdown.

## Solution

- Add `Content.content_type text not null default 'text/plain'`.
- Backfill non-`full` rows as `text/plain` and existing `full` rows as `text/markdown`.

## Done When

- Migrated rows have explicit `content_type`.
- Generated database types include the new field.

## Notes

- `content_type` distinguishes representation format and does not replace `variant`.
```

### 3. Update content uniqueness and upsert surfaces

```md
## Problem

- `full/text/markdown` and `full/DG_ATJSON` cannot coexist under the current unique key.
- Upsert inputs and views do not expose `content_type`.

## Solution

- Update uniqueness and `upsert_content` conflicts to `(space_id, source_local_id, variant, content_type)`.
- Thread `content_type` through `content_local_input`, `_local_content_to_db_content`, views, and generated types.

## Done When

- Upserting one representation does not overwrite another.
- App queries can filter by both `variant` and `content_type`.

## Notes

- ATJSON is a representation, not a new `ContentVariant`.
- Related sequencing context: [ENG-1794](https://linear.app/discourse-graphs/issue/ENG-1794/atomic-upsert-of-concept-and-content) if this touches combined Concept+Content upserts.
```

### 4. Preserve `FileReference` Markdown targeting

```md
## Problem

- `FileReference` currently targets the `full` content row by the old three-column key.
- Adding multiple `full` representations would make that target ambiguous.

## Solution

- Add or derive `FileReference.content_type = 'text/markdown'`.
- Update the foreign key to `(space_id, source_local_id, variant, content_type)`.

## Done When

- File references still attach to `full/text/markdown`.
- Existing asset import behavior is unchanged.

## Notes

- Moving file references into ATJSON is deferred.
```

### 5. Add no-op Next.js content upsert endpoint

```md
## Problem

- Plugin clients write directly to Supabase, which makes future translation/versioning harder.
- We need a server-owned upload boundary before content conversion logic grows.

## Solution

- Add a Next.js upsert endpoint that wraps current content upsert behavior.
- Keep it pass-through for v0 API-hop work.

## Done When

- Endpoint accepts current Obsidian/Roam payloads with explicit `content_type`.
- Existing behavior is preserved through the endpoint.

## Out of Scope

- Full representation negotiation.
- ATJSON materialization.

## Notes

- This is a pass-through boundary only; representation negotiation and ATJSON materialization stay out of scope.
```

### 6. Add no-op Next.js content resolve endpoint

```md
## Problem

- Read paths also need a server-owned boundary before future native-format translation.
- Obsidian import must keep reading current native rows.

## Solution

- Add a resolve endpoint that reads requested rows by `variant` and `content_type`.
- Return current native rows without ATJSON preference.

## Done When

- Obsidian can request `direct/text/plain` and `full/text/markdown`.
- Endpoint does not prefer ATJSON.

## Out of Scope

- ATJSON-to-native rendering in production reads.
```

### 7. Move current Obsidian and Roam flows through endpoints

```md
## Problem

- New endpoints have no value until app writers/readers use them.
- Direct Supabase calls keep translation logic client-versioned.

## Solution

- Update Obsidian publish/import and Roam write paths to use the new endpoints.
- Preserve existing row shapes and current behavior.

## Done When

- Existing Obsidian import still succeeds.
- Existing Roam write behavior still works.

## Notes

- Keep this PR focused on routing, not conversion.
```

## Milestone 2: DG content model

### 8. Scaffold `@repo/content-model`

```md
## Problem

- There is no DG-owned package for canonical content types, validators, and adapters.
- SamePage references are useful but should not become DG's runtime schema.

## Solution

- Add `packages/content-model` with package exports, build, lint, and test setup.
- Expose schema, validation, text, constants, core, adapters, and render modules.

## Done When

- Package builds and can be imported by apps/packages.
- No SamePage sync, networking, Automerge, or protocol code is included.

## Notes

- `@repo/content-model` is DG-owned; do not port SamePage sync, networking, Automerge, IPFS, or protocol runtime code.
```

### 9. Define `DgDocument` schema and validators

```md
## Problem

- ATJSON rows need a stable DG-owned payload shape.
- Invalid spans, blocks, or references would make future renderers unreliable.

## Solution

- Define `DgDocument` with title/body split, inline annotations, block annotations, and typed references.
- Add validators for spans, title rules, block parents, and reference attributes.

## Done When

- Valid documents pass and malformed documents fail package tests.
- `DgDocument.version` is explicit.

## Notes

- Do not use SamePage's schema as the canonical runtime type.
```

### 10. Port parser/render core ideas from SamePage

```md
## Problem

- The adapters need common parsing and annotation rendering behavior.
- Rewriting everything from scratch risks avoidable parser/render bugs.

## Solution

- Adapt SamePage parser helper and annotation render-order patterns into DG-owned core utilities.
- Keep API shape independent of SamePage runtime assumptions.

## Done When

- Core tests cover annotation ordering, nesting, overlap, and replacement behavior.
- No Automerge or SamePage protocol dependencies are introduced.

## Notes

- Reference-only SamePage files: `samepage.network/package/utils/atJsonParser.ts` and `samepage.network/package/utils/renderAtJson.ts`.
- Do not introduce SamePage runtime or protocol dependencies.
```

### 11. Implement Obsidian adapter fixtures

```md
## Problem

- Obsidian Markdown must produce canonical ATJSON rows.
- Future Obsidian renderer parity needs package-level fixtures.

## Solution

- Add Obsidian Markdown to/from `DgDocument` adapters.
- Port useful SamePage leaf parser/renderer fixtures.

## Done When

- Tests cover paragraphs, bullets, numbered lists, links, images, wikilinks, code fences, and delimiter edge cases.
- Adapter preserves current Markdown compatibility expectations.

## Notes

- Reference-only SamePage files: `obsidian-samepage/src/utils/leafParser.ts`, `obsidian-samepage/src/utils/atJsonToObsidian.ts`, and `obsidian-samepage/tests/leafParser.test.ts`.
- Current production Obsidian import must remain on `direct/text/plain` and `full/text/markdown`.
```

### 12. Implement Roam adapter fixtures

```md
## Problem

- Roam ATJSON should be derived from Roam-native page/block structure where available.
- Roam page refs and block refs need typed canonical representation.

## Solution

- Add Roam-native tree/text to/from `DgDocument` adapters.
- Port useful SamePage Roam parser/renderer fixtures.

## Done When

- Tests cover page refs, block refs, hashtags, block hierarchy, links, images, and code.
- Roam block parentage is represented explicitly.

## Notes

- Reference-only SamePage files: `roam-samepage/src/utils/blockParser.ts`, `roam-samepage/src/utils/encodeState.ts`, `roam-samepage/src/utils/atJsonToRoam.ts`, `roam-samepage/src/utils/decodeState.ts`, and `roam-samepage/tests/blockGrammar.test.ts`.
- Related context: [ENG-1847](https://linear.app/discourse-graphs/issue/ENG-1847/define-shared-cross-app-node-content-contract) and [ENG-1848](https://linear.app/discourse-graphs/issue/ENG-1848/add-roam-full-markdown-content-variant-for-shared-nodes) define the Markdown-first baseline this adapter should eventually supersede.
```

### 13. Add package-level HTML renderer

```md
## Problem

- Website publishing will need one canonical HTML path later.
- Renderer parity fixtures are easier to maintain in the shared package.

## Solution

- Add `DgDocument` to HTML rendering in `@repo/content-model`.
- Keep it package-local for v0.

## Done When

- Tests cover representative title/body documents.
- No website production read path is changed.

## Out of Scope

- Website publishing integration.
```

## Milestone 3: Write-only ATJSON rollout

### 14. Write Obsidian ATJSON rows

```md
## Problem

- Obsidian writes native rows but does not store canonical content.
- Renderer development needs real stored ATJSON examples.

## Solution

- Preserve `direct/text/plain` and `full/text/markdown`.
- Add `full/application/vnd.discourse-graph.atjson+json; version=1` with `metadata.content` and derived `text`.

## Done When

- Obsidian upload writes all required rows.
- Existing Obsidian import behavior is unchanged.

## Notes

- The ATJSON row is additive. Preserve current `direct/text/plain` and `full/text/markdown` rows for existing Obsidian import.
```

### 15. Write Roam ATJSON rows

```md
## Problem

- Roam writes text rows but does not store canonical structured content.
- Markdown-derived Roam conversion loses structure when native data is available.

## Solution

- Preserve current Roam text rows.
- Add `full/DG_ATJSON` from Roam-native page/block data where available.

## Done When

- Roam sync writes current rows plus ATJSON.
- ATJSON payload uses `metadata.content`; `text` is derived plain text.

## Notes

- Related context: [ENG-1848](https://linear.app/discourse-graphs/issue/ENG-1848/add-roam-full-markdown-content-variant-for-shared-nodes) keeps Roam's `full` Markdown row for cross-app import, and [ENG-1852](https://linear.app/discourse-graphs/issue/ENG-1852/keep-roam-shared-node-content-fresh-in-the-sync-loop) covers Roam shared-node freshness.
- ATJSON must be written alongside the native rows, not instead of them.
```

### 16. Guard search and embeddings

```md
## Problem

- Serialized JSON in `text` or embeddings would damage search and duplicate detection.
- ATJSON rows should remain inspectable without polluting text-centered tools.

## Solution

- Store only derived plain text in `Content.text`.
- Ensure embedding inputs never use serialized ATJSON.

## Done When

- Tests prove ATJSON JSON is not stored in `text`.
- Inline embeddings are limited to intentional human-readable rows.

## Notes

- Serialized ATJSON JSON must never be stored in `Content.text` or sent to embeddings.
- If ATJSON rows are embedded later, embed their derived human-readable `text` projection.
```

### 17. Keep destination readers native-only

```md
## Problem

- Switching readers before renderer parity risks breaking current imports.
- v0 is explicitly write-only for ATJSON.

## Solution

- Keep Obsidian import on `direct/text/plain` and `full/text/markdown`.
- Do not add ATJSON preference to production readers.

## Done When

- Obsidian import succeeds after ATJSON rows exist.
- No destination reader prefers ATJSON in v0.

## Out of Scope

- ATJSON-preferred import.
- ATJSON-to-Roam materialization in production reads.
```

## Milestone 4: Validation and follow-up scope

### 18. Add database regression coverage

```md
## Problem

- Storage changes touch keys, views, upserts, file references, and embeddings.
- Regressions could break current import/sync paths.

## Solution

- Add database tests for backfill, coexistence, views, conflicts, file references, and embedding guards.

## Done When

- Database test suite covers all storage acceptance criteria from the scope.
- Tests fail if ATJSON overwrites Markdown rows.
```

### 19. Add app regression coverage

```md
## Problem

- App write/read behavior must stay stable while ATJSON rows are added.
- Endpoint routing and dual writes need coverage.

## Solution

- Add focused Obsidian and Roam app tests around publish/import/sync content rows.

## Done When

- Obsidian compatibility tests pass with ATJSON rows present.
- Roam sync compatibility tests pass with ATJSON rows present.
```

### 20. Manual validation pass

```md
## Problem

- Automated tests may not catch plugin workflow or host-app integration issues.
- Current Obsidian publish/import is the compatibility baseline.

## Solution

- Manually validate Obsidian publish/import and Roam local-to-remote sync against migrated storage.

## Done When

- Manual validation notes confirm current flows work after ATJSON rows exist.
- Any blockers are ticketed before rollout.
```

### 21. Create v1 follow-up tickets

```md
## Problem

- Renderer/read-path work is intentionally deferred from v0.
- Deferred scope needs concrete follow-up tickets before the project closes.

## Solution

- Create tickets for ATJSON-preferred reads, ATJSON-to-Obsidian import, ATJSON-to-Roam materialization, HTML publishing, representation negotiation, and native storage policy.

## Done When

- Follow-up issues exist and are linked from the project.
- Each issue states renderer parity requirements before reader switch-over.

## Notes

- Include follow-up tickets for ATJSON-preferred reads, ATJSON-to-Obsidian import, ATJSON-to-Roam materialization, HTML publishing, representation negotiation, and native storage policy.
- Related handoff context: [ENG-1882](https://linear.app/discourse-graphs/issue/ENG-1882/document-mvp0-markdown-fidelity-limits-and-v1-atjson-handoff).
```

## Assumptions

- v0 stores native + ATJSON rows during transition.
- Next.js hop lands before meaningful translation so client versioning is easier later.
- Production readers do not prefer ATJSON until renderer parity is intentionally shipped.
