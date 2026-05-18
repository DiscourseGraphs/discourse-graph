# ATJSON canonical storage and conversion rollout scope

## How to use

Use this scope as the project contract for adding ATJSON as the canonical stored content representation in Discourse Graphs.

This document clarifies:

- what the v0 rollout is trying to accomplish
- what must keep working during the rollout
- what is in scope now
- what is explicitly deferred
- which user and system behaviors matter
- what needs to be built
- what counts as done
- what remains unknown

Keep the detailed implementation plans in the related notes. This scope should stay lightweight enough to guide Linear issue creation and review.

## Metadata

- **Status**: DRAFT
- **Owner**: TBD
- **Reviewers**: DB admin, app/plugin owner, content-model owner
- **Related notes**:
  - `docs/atjson-canonical-storage-plan.md`
  - `docs/atjson-port-plan.md`
- **Related Linear project/issues**: TBD

## 1. Summary

- **One-sentence summary**: Add DG ATJSON as the canonical stored content representation while preserving the current Obsidian Markdown sink/import flow.
- **Problem**: Discourse Graphs currently stores app-native text and Markdown rows, but does not yet persist a portable canonical content model that can later render cleanly to Obsidian, Roam, and website publishing surfaces.
- **Proposed solution**: Add `Content.content_type`, keep `variant` as the semantic content slice, and write canonical DG ATJSON rows alongside existing text and Markdown rows, with the structured document stored in `Content.metadata.content` and derived plain text stored in `Content.text`.
- **Expected outcome**: The database can store canonical ATJSON without interrupting current Obsidian behavior, and the later ATJSON-to-Obsidian, ATJSON-to-Roam, and HTML conversion work has a stable storage target.

**Implementation note**: The PR-shaped implementation includes package-level Obsidian, Roam, and HTML renderers earlier than the original v0 scope so parity tests can live with the shared content model. Production destination readers still do not prefer ATJSON in this rollout.

## 2. Goal + Non-Goals

### Goal

Add write-only canonical ATJSON storage for Discourse Graphs content in a way that keeps all current app flows working.

The v0 goal is specifically to:

- treat `variant` as the semantic slice, such as `direct`, `full`, or `direct_and_description`
- treat `content_type` as the representation, such as `text/plain`, `text/markdown`, or `application/vnd.discourse-graph.atjson+json; version=1`
- store canonical DG ATJSON in `Content.metadata.content`
- keep `Content.text` as a derived plain-text projection for search, previews, duplicate detection, and existing text-centered tooling
- keep existing Obsidian imports reading `direct/text/plain` and `full/text/markdown`
- prepare for later ATJSON-to-Obsidian and ATJSON-to-Roam renderers

### Non-Goals

- Do not replace the current Obsidian Markdown import path in v0.
- Do not make destination readers prefer ATJSON in v0.
- Do not port SamePage wholesale.
- Do not introduce SamePage sync, networking, Automerge, IPFS, or protocol runtime code.
- Do not serialize ATJSON into `Content.text`.
- Do not embed serialized ATJSON JSON.
- Do not introduce a new `ContentVariant` for ATJSON.
- Do not make Markdown a final cross-app canonical format.

## 3. v0 Scope

### In scope

- Add `Content.content_type`.
- Backfill existing content rows into explicit content types.
- Update content uniqueness to include `content_type`.
- Update `FileReference` to continue pointing at the Markdown `full` content row.
- Update `content_local_input`, `_local_content_to_db_content`, `upsert_content`, views, and generated database types.
- Add shared content type constants:
  - `text/plain`
  - `text/markdown`
  - `application/vnd.discourse-graph.atjson+json; version=1`
- Create or use a DG-owned `DgDocument` canonical model.
- Write ATJSON rows from Obsidian without changing the current Markdown rows.
- Write ATJSON rows from Roam without removing existing text rows.
- Store ATJSON payloads in `metadata.content`.
- Store derived plain text in `text`.
- Add tests and manual validation proving the existing Obsidian sink/import still works.

### Out of scope

- ATJSON-preferred import.
- ATJSON-to-Obsidian rendering in production app reads.
- ATJSON-to-Roam rendering or materialization in production app reads.
- API content negotiation.
- Native export as a stored canonical format.
- Replacing existing Markdown asset/file-reference behavior.
- Continuous sync or automatic background import behavior beyond what exists today.

### Deferred to v1+

- Switch production destination readers to prefer ATJSON.
- Harden renderer parity tests beyond the initial package-level fixtures.
- Add website publishing integration that consumes the shared HTML renderer.
- Decide whether native exports should also be stored as durable representations.
- Decide long-term content API representation negotiation.

## 4. In-Scope Use Cases

### UC1: Existing Obsidian user continues publishing and importing content

- **Actor**: Discourse Graphs user in Obsidian.
- **Trigger**: User publishes or imports content using the current working Obsidian flow.
- **Happy path**:
  1. User publishes or imports content from Obsidian.
  2. Existing `direct/text/plain` title rows and `full/text/markdown` body rows remain available.
  3. Obsidian import continues to materialize Markdown from the same representation it uses today.
- **Frequency**: Regularly; this is the compatibility baseline.

### UC2: Obsidian-authored content is stored as canonical ATJSON

- **Actor**: Discourse Graphs user in Obsidian.
- **Trigger**: User syncs or publishes an Obsidian-authored DG node.
- **Happy path**:
  1. User creates or updates a DG node in Obsidian.
  2. The current text and Markdown content rows are written as before.
  3. A canonical ATJSON row is also written for the same content.
  4. The ATJSON document is available for later cross-app rendering work.
- **Frequency**: Every Obsidian write after v0 rollout is enabled.

### UC3: Roam-authored content is stored as canonical ATJSON

- **Actor**: Discourse Graphs user in Roam.
- **Trigger**: User syncs a Roam page or block tree into Discourse Graphs.
- **Happy path**:
  1. User updates content in Roam.
  2. Existing Roam text rows continue to be written.
  3. A canonical ATJSON row is also written from the Roam-native page/block structure.
  4. The ATJSON document preserves enough structure for later Roam and Obsidian renderers.
- **Frequency**: Every Roam write after v0 rollout is enabled.

### UC4: Engineer validates canonical payloads before read-path rollout

- **Actor**: Engineer or database admin.
- **Trigger**: Preparing to build ATJSON-to-Obsidian, ATJSON-to-Roam, or HTML rendering.
- **Happy path**:
  1. Engineer queries content rows by `variant` and `content_type`.
  2. Engineer inspects `Content.metadata.content` for canonical DG ATJSON.
  3. Engineer uses the derived `Content.text` projection for search, previews, or debugging.
  4. Renderer work can proceed against real stored canonical documents without changing current readers.
- **Frequency**: During migration validation and renderer development.

## 5. Constraints / Assumptions / Dependencies

### Constraints

- The current Obsidian sink/import path must keep working throughout the rollout.
- ATJSON must be added alongside existing rows before any reader is switched over.
- Existing text-centered tooling should still be able to use `Content.text`.
- `FileReference` must continue to attach to the current Markdown `full` row until asset handling is intentionally moved to ATJSON.
- Database type generation must happen after schema changes.

### Assumptions

- `variant` is the semantic content slice, not the representation format.
- `content_type` is the representation discriminator.
- ATJSON payloads live in `Content.metadata.content`.
- `Content.text` on ATJSON rows is derived plain text.
- The canonical model is DG-owned and ATJSON-compatible, not SamePage's exact runtime schema.
- The first rollout is write-only for ATJSON.

### Dependencies

- Database migration support for `packages/database/supabase/schemas/content.sql`.
- Generated Supabase type updates in `packages/database/src/dbTypes.ts`.
- Current app writers in `apps/obsidian` and `apps/roam`.
- SamePage reference parser and renderer code listed in `docs/atjson-canonical-storage-plan.md`.
- Shared `@repo/content-model` package work from `docs/atjson-port-plan.md`.

## 6. Requirements

### Functional requirements

#### F1: Add content representation discriminator

- **Milestone**: Milestone 2
- **Requirement**: Add `Content.content_type text not null default 'text/plain'` and expose it through relevant content inputs, views, functions, and generated types.
- **Acceptance criteria**:
  - Existing non-`full` rows resolve to `text/plain`.
  - Existing `full` rows resolve to `text/markdown`.
  - `my_contents` exposes `content_type`.
  - App queries can filter by both `variant` and `content_type`.
- **Notes**: `content_type` distinguishes representation; it does not replace `variant`.

#### F2: Allow multiple representations for the same content slice

- **Milestone**: Milestone 2
- **Requirement**: Update content uniqueness and upsert behavior to use `(space_id, source_local_id, variant, content_type)`.
- **Acceptance criteria**:
  - A `full/text/markdown` row and a `full/application/vnd.discourse-graph.atjson+json; version=1` row can coexist.
  - Upserting one representation does not overwrite another representation for the same content slice.
  - `upsert_content` conflicts on the four-column key.
- **Notes**: Do not add ATJSON as a `ContentVariant`.

#### F3: Store canonical ATJSON in metadata

- **Milestone**: Milestones 3 and 4
- **Requirement**: Store canonical DG ATJSON in `Content.metadata.content` and store only derived plain text in `Content.text`.
- **Acceptance criteria**:
  - ATJSON rows use `content_type = 'application/vnd.discourse-graph.atjson+json; version=1'`.
  - ATJSON rows store a valid `DgDocument` in `metadata.content`.
  - ATJSON rows do not store serialized JSON in `text`.
  - Search and preview tooling can use the derived plain-text projection.
- **Notes**: This reflects the database guidance that the content itself should be in the metadata JSON blob.

#### F4: Preserve current Obsidian import behavior

- **Milestone**: Milestones 2 and 4
- **Requirement**: Keep Obsidian import reading `direct/text/plain` and `full/text/markdown` until ATJSON renderer parity exists.
- **Acceptance criteria**:
  - Existing Obsidian import still succeeds after `content_type` is introduced.
  - Obsidian import does not prefer ATJSON in v0.
  - Current Markdown body behavior remains unchanged.
- **Notes**: This is the key compatibility requirement.

#### F5: Keep file references attached to Markdown rows

- **Milestone**: Milestone 2
- **Requirement**: Update `FileReference` so it still points to the Markdown `full` content row after content uniqueness includes `content_type`.
- **Acceptance criteria**:
  - `FileReference` has or derives `content_type = 'text/markdown'`.
  - The foreign key references `(space_id, source_local_id, variant, content_type)`.
  - Existing asset/file-reference behavior continues to work.
- **Notes**: Moving file references into ATJSON is deferred.

#### F6: Write ATJSON alongside existing Obsidian rows

- **Milestone**: Milestone 4
- **Requirement**: Update the Obsidian writer to keep writing current rows and additionally write `full/application/vnd.discourse-graph.atjson+json; version=1`.
- **Acceptance criteria**:
  - Obsidian still writes `direct/text/plain`.
  - Obsidian still writes `full/text/markdown`.
  - Obsidian also writes `full/application/vnd.discourse-graph.atjson+json; version=1`.
  - The ATJSON row uses `metadata.content` for the canonical document and `text` for derived plain text.
- **Notes**: This should not change the current import path.

#### F7: Write ATJSON alongside existing Roam rows

- **Milestone**: Milestone 4
- **Requirement**: Update the Roam writer to keep current text rows and additionally write `full/application/vnd.discourse-graph.atjson+json; version=1`.
- **Acceptance criteria**:
  - Existing Roam write behavior remains intact.
  - Roam ATJSON is derived from Roam-native page/block structure, not from Markdown when native structure is available.
  - The ATJSON row uses `metadata.content` for the canonical document and `text` for derived plain text.
- **Notes**: If cross-app Markdown import is needed before ATJSON renderers are ready, Roam may also need to emit `full/text/markdown` for shared nodes.

#### F8: Define shared content type constants

- **Milestone**: Milestone 3
- **Requirement**: Define shared constants for supported content types and use them from app writers/readers.
- **Acceptance criteria**:
  - Constants exist for `text/plain`, `text/markdown`, and DG ATJSON.
  - App code does not rely on repeated raw content-type strings where a shared constant is available.
- **Notes**: The constants should live where both app code and storage integration code can use them without circular dependencies.

#### F9: Map later conversion rollout without activating it

- **Milestone**: Milestone 5
- **Requirement**: Document the follow-up path for ATJSON-to-Obsidian, ATJSON-to-Roam, HTML rendering, and API representation negotiation.
- **Acceptance criteria**:
  - The follow-up work is captured as deferred scope.
  - Destination readers remain on current text/Markdown rows in v0.
  - Renderer parity tests are required before reader switch-over.
- **Notes**: The implementation plan is in `docs/atjson-port-plan.md`.

### Non-functional requirements

#### N1: Backward compatibility

- **Requirement**: Existing Obsidian publish/import and Roam write behavior must continue to work during and after the v0 rollout.
- **Acceptance criteria**:
  - Manual validation confirms current Obsidian import still works after ATJSON rows exist.
  - Existing readers do not break when multiple representations exist for the same content slice.

#### N2: Data clarity

- **Requirement**: Stored rows must make semantic slice and representation format explicit.
- **Acceptance criteria**:
  - Engineers can identify content by both `variant` and `content_type`.
  - ATJSON is not hidden inside `variant` names or serialized into text fields.

#### N3: Search and embedding safety

- **Requirement**: Text search, previews, duplicate detection, and embeddings must operate on human-readable text projections, not serialized ATJSON.
- **Acceptance criteria**:
  - ATJSON rows store derived plain text in `Content.text`.
  - Serialized ATJSON is never sent to embedding generation.
  - `upsert_content` ignores inline embeddings on non-`text/plain` rows, including Markdown and ATJSON representations.

#### N4: Type safety and maintainability

- **Requirement**: TypeScript code should use typed content constants and shared model types where practical.
- **Acceptance criteria**:
  - Generated database types are updated after schema changes.
  - App code can compile against the new `content_type` field.
  - New conversion code avoids `any` where practical.

#### N5: Explicit rollout

- **Requirement**: v0 should not introduce new implicit sync or automatic read-path switching.
- **Acceptance criteria**:
  - ATJSON rows are written explicitly by existing write flows.
  - Destination readers switch to ATJSON only in a later planned phase.

## 7. Milestones

### Milestone 1: Scope and storage decision finalized

- **Deliverable**: Approved scope plus linked architecture and storage plans.
- **Acceptance criteria**:
  - The team agrees that `variant` is the semantic slice.
  - The team agrees that `content_type` is the representation discriminator.
  - The team agrees that ATJSON content lives in `metadata.content`.
  - The team agrees that `text` remains a derived plain-text projection.
- **Dependencies**: DB admin review.
- **Estimate**: 0.5-1 day.

### Milestone 2: Database supports multiple representations

- **Deliverable**: Schema, function, view, FileReference, and generated type updates.
- **Acceptance criteria**:
  - Existing rows are backfilled into explicit content types.
  - Multiple content representations can coexist for the same semantic slice.
  - Current Obsidian import queries can still find title and Markdown body rows.
  - File references still attach to Markdown `full` rows.
- **Dependencies**: Migration review and database type regeneration.
- **Estimate**: 1-2 days.

### Milestone 3: Canonical content model can be produced

- **Deliverable**: Minimal DG-owned ATJSON-compatible `DgDocument` model and source-to-canonical conversion needed for write-only storage.
- **Acceptance criteria**:
  - Obsidian content can produce a canonical document.
  - Roam page/block content can produce a canonical document.
  - Derived plain text can be produced from the canonical document.
  - Validation covers spans, title/body rules, block parents, and reference attributes.
- **Dependencies**: `@repo/content-model` package work.
- **Estimate**: 2-5 days, depending on adapter depth included in v0.

### Milestone 4: Write-only ATJSON rollout

- **Deliverable**: Obsidian and Roam writers add ATJSON rows while preserving existing rows.
- **Acceptance criteria**:
  - Obsidian writes current rows plus ATJSON.
  - Roam writes current rows plus ATJSON.
  - ATJSON payloads are in `metadata.content`.
  - `text` contains derived plain text.
  - Existing Obsidian import still works.
- **Dependencies**: Milestones 2 and 3.
- **Estimate**: 1-3 days.

### Milestone 5: Deferred conversion rollout mapped

- **Deliverable**: Follow-up scope or issues for renderers and read-path switch-over.
- **Acceptance criteria**:
  - ATJSON-to-Obsidian renderer work is ticketed.
  - ATJSON-to-Roam renderer/materializer work is ticketed.
  - HTML rendering work is ticketed.
  - API representation negotiation is explicitly deferred or scoped.
- **Dependencies**: Stored ATJSON examples from Milestone 4.
- **Estimate**: 0.5-1 day for scoping; implementation estimated separately.

## 8. Open Questions

### OQ1: Where should shared content type constants live?

- **Current leaning**: Put them in the shared content-model package if it can be consumed cleanly by app writers; otherwise use a small shared database/content constants module.

### OQ2: How much of the Obsidian and Roam parser work is required for v0?

- **Current leaning**: Implement only enough source-to-canonical conversion for write-only ATJSON rows, then deepen fidelity during renderer parity work.

### OQ3: Should Roam emit `full/text/markdown` before ATJSON readers exist?

- **Current leaning**: Only if cross-app Markdown import from Roam-authored shared nodes must work before ATJSON-to-Obsidian rendering is active.

### OQ4: Should native export formats become stored durable representations?

- **Current leaning**: Defer until canonical ATJSON storage and app renderers are stable.

### OQ5: What is the long-term source for embeddings?

- **Current leaning**: Keep embeddings based on human-readable derived text, not serialized structured content.

## 9. Risks

### Risk: Existing Obsidian import breaks during schema migration

- **Impact**: Users lose the current working sink/import path.
- **Mitigation**: Backfill before enforcing new uniqueness, update queries to filter explicit content types, and manually validate current Obsidian import before enabling ATJSON writes.

### Risk: ATJSON rows overwrite Markdown rows

- **Impact**: Existing Markdown import behavior breaks or data is lost.
- **Mitigation**: Use `(space_id, source_local_id, variant, content_type)` as the uniqueness key and update `upsert_content` conflict behavior.

### Risk: Serialized JSON enters search or embedding paths

- **Impact**: Search quality drops, embeddings become noisy, and text tooling becomes harder to reason about.
- **Mitigation**: Store canonical content in `metadata.content`; store only derived plain text in `text`; keep app embedding requests on `text/plain`; make `upsert_content` ignore inline embeddings on Markdown and ATJSON rows; add regression tests.

### Risk: File references lose their target row

- **Impact**: Assets attached to Obsidian Markdown content break.
- **Mitigation**: Add or derive `FileReference.content_type = 'text/markdown'` and update the foreign key to the four-column content key.

### Risk: Canonical model overfits SamePage

- **Impact**: DG inherits SamePage-specific assumptions that do not fit Roam, Obsidian, and website publishing.
- **Mitigation**: Use SamePage as a reference, but define a DG-owned `DgDocument` with explicit title/body split, typed references, and block identity.

### Risk: Readers switch to ATJSON before renderer parity

- **Impact**: Import behavior changes before ATJSON-to-native rendering is trustworthy.
- **Mitigation**: Keep v0 write-only and require renderer parity tests before read-path switch-over.

## 10. Approval Checklist

- {{[[TODO]]}} Goal is clear.
- {{[[TODO]]}} v0 scope is clear.
- {{[[TODO]]}} Out-of-scope items are explicit.
- {{[[TODO]]}} Use cases describe user/system workflows, not implementation debate.
- {{[[TODO]]}} Functional requirements can become Linear issues.
- {{[[TODO]]}} Non-functional requirements are concrete and testable.
- {{[[TODO]]}} Milestones have acceptance criteria.
- {{[[TODO]]}} Open questions and risks are captured.
