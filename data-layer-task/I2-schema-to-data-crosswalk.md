# I2. Schema-to-data crosswalk

## Purpose

This note is the milestone-two deliverable from [H. V0 scope: data-layer definition and crosswalk](./H-v0-data-layer-scope.md).

It provides the core crosswalk needed for v0 portable-package and interchange work:

- schema-layer concept
- current shared data-layer representation
- current client-local representation where relevant
- current transport or export representation
- the main caveat when the mapping is only partial, lossy, or indirect

This is intentionally a current-state doc. It describes what the repo does now, not the ideal future model.

## Core crosswalk

| Concept                        | Schema-layer meaning                                                               | Current shared data-layer representation                                                                                                                                  | Current client-local representation                                                                                                          | Current transport / package-facing representation                                                                                | Mapping quality and caveats                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node schema                    | Abstract discourse node class such as `Question`, `Claim`, `Evidence`, or `Source` | `Concept` schema row with `is_schema=true` and `arity=0`; built-ins are ordinary schema rows, not special tables                                                          | Obsidian node-type settings and `DiscourseNode`; Roam discourse node settings and block/page-derived node definitions                        | Sync `LocalConceptDataInput`; Roam JSON-LD node-schema export; future portable `nodeTypes[]`                                     | Clean enough for v0. Shared persistence does not special-case built-in node classes.                                                                             |
| Relation schema                | Abstract relation predicate and role structure                                     | `Concept` schema row with `is_schema=true`, `arity>0`, and role metadata in `literal_content`                                                                             | Obsidian relation settings plus local triple/admissibility config; Roam relation settings                                                    | Sync `LocalConceptDataInput`; Roam JSON-LD `relationDef`; future portable `relationTypes[]`                                      | Partially lossy. Obsidian triple-schema or admissibility distinctions are mostly client-side and only implicit in shared persistence.                            |
| Node instance                  | Concrete discourse item                                                            | `Concept` instance row with `schema_id` pointing to a node schema; usually paired with one or more `Content` rows and sometimes a `Document` row                          | Obsidian markdown note plus frontmatter; Roam page or block-derived discourse node                                                           | API note/page payloads, import/export flows, JSON-LD node export, future portable `nodes[]` plus `content`                       | Split representation. The semantic record lives in `Concept`, while the human-readable representation lives in `Content`.                                        |
| Relation instance              | Assertion connecting node instances                                                | `Concept` instance row with `is_schema=false`, `schema_id` pointing to a relation schema, and `reference_content` holding role bindings; generated `refs` supports lookup | Obsidian `relations.json`; Roam reified relation blocks and hidden block props                                                               | Obsidian share/import relation flows, Roam JSON-LD `relationInstance`, future portable `relations[]`                             | This is the most important current mapping: relation instance = `Concept` + `schema_id` + `reference_content`. There is no dedicated edge/assertion table today. |
| Content                        | Human-readable textual representation of a discourse item                          | `Content` row keyed by source identity and `variant`; common variants include `direct`, `full`, and `direct_and_description`                                              | Obsidian note title/body/frontmatter; Roam extracted title/text for sync/search                                                              | Content API payloads, import/export note bodies, future portable `content` field                                                 | Not one-to-one. One concept can correspond to multiple content variants.                                                                                         |
| Document                       | Source note, page, or other document container                                     | `Document` row identified by source identity or URL; may store source-container metadata and backing contents                                                             | Obsidian file path and note container metadata; Roam page/container metadata                                                                 | Document API payloads, import/export metadata, future portable source/document metadata                                          | Usually straightforward, but not every flow needs to expose `Document` as a first-class portable object.                                                         |
| Concept-to-content linkage     | Relationship between a semantic thing and its textual representation               | Indirect via `(space_id, source_local_id)` and `public.content_of_concept`; no dedicated concept-content link table                                                       | Usually implicit because the same note or page supplies both semantics and content                                                           | Current import flows resolve specific content variants; future portable package must choose a canonical `content` representation | Not structurally one-to-one even when documentation treats it that way. This is a core caveat for v0.                                                            |
| Share/access state             | Who can access a space or a resource                                               | `SpaceAccess`, `ResourceAccess`, and `LocalAccess`                                                                                                                        | Obsidian local share markers such as `publishedToGroups` and relation-share bookkeeping; Roam currently has less local share-state machinery | Access-filtered queries, shared-node import lists, group-scoped flows                                                            | Operational data, not part of the conceptual discourse schema. Needed for app sharing, but not a core portable-package payload requirement.                      |
| File assets                    | Binary files attached to content                                                   | `FileReference` rows plus Supabase storage blobs; file references attach to the `full` content variant in the current schema                                              | Obsidian vault assets and embed links; Roam file/image references in blocks                                                                  | Asset fetch/import flows, website media rendering, future portable `assets[]` plus asset files                                   | Important current caveat: asset linkage is tied to the `full` content variant today.                                                                             |
| RID / ORN / transport identity | Cross-space identifier used in import, export, and lookup                          | Resolved into `(space_id, source_local_id)` by helper functions; not stored as the primary DB key                                                                         | Ad hoc local fields such as `importedFromRid`; Obsidian and Roam keep local IDs separately                                                   | RID strings in import/export, API lookups, future portable stable-identity object                                                | Transport projection, not canonical persistence. Still required to preserve cross-space identity.                                                                |

## Built-in vocabulary examples

The built-in discourse classes do not have bespoke storage tables. They follow the same mapping as any other node schema.

| Built-in term | Schema-layer meaning | Current shared data-layer representation | Current client-local representation   | Transport / package-facing representation                      |
| ------------- | -------------------- | ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `Question`    | Built-in node class  | Ordinary `Concept` schema row            | Default node type in app-local config | TTL class, sync concept payload, future portable `nodeTypes[]` |
| `Claim`       | Built-in node class  | Ordinary `Concept` schema row            | Default node type in app-local config | TTL class, sync concept payload, future portable `nodeTypes[]` |
| `Evidence`    | Built-in node class  | Ordinary `Concept` schema row            | Default node type in app-local config | TTL class, sync concept payload, future portable `nodeTypes[]` |
| `Source`      | Built-in node class  | Ordinary `Concept` schema row            | Default node type in app-local config | TTL class, sync concept payload, future portable `nodeTypes[]` |

## What is one-to-one vs not

The crosswalk is intentionally one-to-one as documentation, but the storage is not always one-to-one.

### Clean or mostly clean

- node schema -> `Concept` schema row
- relation schema -> `Concept` schema row
- document/container -> `Document`
- file asset metadata -> `FileReference`

### Documentable but structurally indirect

- node instance -> semantic `Concept` plus one or more `Content` rows and sometimes `Document`
- relation instance -> one `Concept` row plus `schema_id` plus `reference_content`
- transport identity -> helper-resolved RID or ORN rather than a canonical DB key

### Currently ambiguous or lossy

- concept-to-content linkage is implicit, not explicit
- one concept can correspond to multiple content variants
- Obsidian relation admissibility or triple-schema behavior is richer than the shared model
- Roam and Obsidian relation handling are not yet symmetric in shared sync behavior

## Minimum implications for the next milestone

Milestone three does not need to redesign the current model. It only needs to preserve the semantics that this crosswalk makes visible:

- node schemas and relation schemas
- node instances and relation instances
- canonical content chosen out of the current content-variant story
- source or document metadata where needed
- file assets
- stable transport identity

The portable package or interchange layer should be derived from this crosswalk, not treated as a replacement for it.
