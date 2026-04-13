# K. Obsidian-to-Obsidian sync overview for portable package

## Purpose

This note explains how the current Obsidian-to-Obsidian sharing flow works today and how it relates to the planned portable package.

The goal is not to restate the whole data-layer definition. The goal is to make the current Obsidian implementation legible enough that we can answer:

- what functions are involved today
- what scope each function owns
- which parts are transport-specific versus Obsidian-specific
- which parts can likely be reused for a portable package
- which parts would need to change if the transport becomes package-first instead of Supabase-query-first

## Short answer

The current Obsidian-to-Obsidian flow is **not** a portable-package flow.

It is a three-stage pipeline:

1. local Obsidian nodes and relations are synced into shared Supabase persistence
2. selected nodes are published to other spaces or groups through access records
3. another Obsidian vault imports those nodes by querying shared persistence, then reconstructs local files, relations, node types, relation types, and assets

That means the current implementation already has many pieces that a portable package will need, but they are split across:

- internal sync logic
- publication and access logic
- remote query and import logic

For v0, the portable package should mainly replace the **remote query/import layer** first. It does not need to replace the entire local sync stack.

## Current implementation shape

### 1. Local sync into shared persistence

This stage takes local Obsidian state and writes it into shared persistence.

Primary orchestrator:

- `syncAllNodesAndRelations` in `apps/obsidian/src/utils/syncDgNodesToSupabase.ts`

What it does:

- collects local discourse node files
- detects changed node titles and content
- writes content records
- writes concept records
- syncs assets for already-published nodes

Important helper functions:

| Function                                       | File                                    | Scope today                                                   | Portable-package relevance                      |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `syncAllNodesAndRelations`                     | `syncDgNodesToSupabase.ts`              | Top-level sync entrypoint                                     | Mostly upstream of the package                  |
| `buildChangedNodesFromNodes`                   | `syncDgNodesToSupabase.ts`              | Detects which local files need sync and what changed          | Internal only                                   |
| `upsertNodesToSupabaseAsContentWithEmbeddings` | `upsertNodesAsContentWithEmbeddings.ts` | Writes `Content` and `Document` records, including embeddings | Not package logic                               |
| `convertDgToSupabaseConcepts`                  | `syncDgNodesToSupabase.ts`              | Writes `Concept` rows for schemas, nodes, and relations       | Upstream of the package                         |
| `syncPublishedNodesAssets`                     | `syncDgNodesToSupabase.ts`              | Ensures published nodes push non-text assets to storage       | Useful conceptually, not as shared package code |

### 2. Concept mapping during sync

This stage maps Obsidian-local shapes into the shared data layer.

Primary file:

- `apps/obsidian/src/utils/conceptConversion.ts`

What it does:

- maps node schemas to local concept inputs
- maps relation types to local concept inputs
- maps relation triple schemas to local concept inputs
- maps note instances to local concept inputs
- maps relation instances from `relations.json` to local concept inputs
- orders concepts so dependencies are written before dependents

Important helper functions:

| Function                                      | Scope today                                        | Portable-package relevance                      |
| --------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `discourseNodeSchemaToLocalConcept`           | Node type schema to `LocalConceptDataInput`        | Reusable as producer-side normalization logic   |
| `discourseRelationTypeToLocalConcept`         | Relation type schema to `LocalConceptDataInput`    | Reusable as producer-side normalization logic   |
| `discourseRelationTripleSchemaToLocalConcept` | Triple schema to `LocalConceptDataInput`           | Useful for understanding current schema leakage |
| `discourseNodeInstanceToLocalConcept`         | Local note instance to `LocalConceptDataInput`     | Useful upstream, not package payload itself     |
| `relationInstanceToLocalConcept`              | Local relation instance to `LocalConceptDataInput` | Important for relation semantics                |
| `orderConceptsByDependency`                   | Ensures schemas are upserted before instances      | Reusable pattern, not package-specific          |

### 3. Publish and access layer

This stage exposes already-synced data to other spaces or groups.

Primary file:

- `apps/obsidian/src/utils/publishNode.ts`

What it does:

- publishes a node to a group
- publishes schemas needed by that node
- publishes relations that are valid to share
- uploads non-text file assets
- creates or updates `SpaceAccess` and `ResourceAccess`

Important helper functions:

| Function                           | Scope today                                                     | Portable-package relevance                     |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `publishNode`                      | Entry point for publishing a local note                         | Publication wrapper, not package logic         |
| `publishNodeToGroup`               | Creates access records and uploads assets                       | Not package logic                              |
| `publishSchema`                    | Publishes schema resources for the node                         | Useful for identifying package dependencies    |
| `publishNodeRelations`             | Publishes related relation resources                            | Useful conceptually, not portable package code |
| `publishNewRelation`               | Publishes a newly created relation if endpoints are publishable | Publication-side only                          |
| `ensurePublishedRelationsAccuracy` | Repairs mismatch between relation state and publish records     | Publication-side only                          |

This is the clearest place where current Obsidian-to-Obsidian sync differs from a portable package. A portable package should not need `SpaceAccess`, `ResourceAccess`, or group-specific publication state in order to move a node bundle.

## How nodes are queried today

### Importable node discovery

Primary file:

- `apps/obsidian/src/utils/importNodes.ts`

The current flow is:

1. `getAvailableGroupIds` retrieves the groups the current user can access.
2. `getPublishedNodesForGroups` queries `my_contents` and excludes the current space.
3. latest content rows are grouped by `(space_id, source_local_id)`.
4. the importer prefers the `direct` variant for the node title and uses the latest timestamps across variants.
5. local node instance IDs are collected with `getLocalNodeInstanceIds` so already-imported nodes can be filtered out.

Important functions:

| Function                               | Scope today                                    | Portable-package relevance                                           |
| -------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `getAvailableGroupIds`                 | Gets visible groups for the current user       | Not package logic                                                    |
| `getPublishedNodesForGroups`           | Finds importable nodes through `my_contents`   | Would be replaced by package manifest reading                        |
| `getLocalNodeInstanceIds`              | Finds already-existing local node instance IDs | Reusable in Obsidian consumer adapter                                |
| `getSpaceNameFromIds` / `getSpaceUris` | Resolves source space metadata                 | Likely still useful if stable source identity remains in the package |

Important observation:

- `getPublishedNodesForGroups` is still Supabase-view-driven and effectively depends on RLS and visible resources.
- A portable package should invert this. The bundle should already contain the importable node list and required payloads, so the importer should not need to query `my_contents` to discover what exists inside the transport.

## How content is queried today

Current Obsidian import uses two storage variants:

- `direct`: title or filename representation
- `full`: full markdown note content

Important functions in `importNodes.ts`:

| Function                       | Scope today                                            | Portable-package relevance                                        |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------- |
| `fetchNodeContent`             | Fetches one variant from `my_contents`                 | Supabase-specific                                                 |
| `fetchNodeContentWithMetadata` | Fetches text plus timestamps for one variant           | Supabase-specific                                                 |
| `fetchNodeContentForImport`    | Fetches both `direct` and `full` variants in one query | Supabase-specific, but same information must exist in the package |
| `getSourceContentDates`        | Retrieves original timestamps for imported content     | Likely useful if origin metadata stays in the package             |

Important observation:

- The current importer is coupled to the internal `direct`/`full` storage split.
- The portable package should not expose that split as its public transport abstraction.
- Instead, the portable package should carry one normalized `content` payload, likely `ATJSON`, and the Obsidian consumer should derive:
  - note body
  - note title or filename behavior
  - frontmatter updates

## How files and assets are handled today

Assets are part of the current Obsidian-to-Obsidian path already.

### On publish

Inside `publishNodeToGroup`:

- Obsidian note embeds are read from metadata cache
- linked attachments are resolved to vault files
- non-text assets are uploaded using `addFile`
- file metadata is stored through `FileReference`
- removed files are cleaned up from `FileReference`

### On import

Inside `importNodes.ts`:

| Function                   | Scope today                                                                     | Portable-package relevance                         |
| -------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `fetchFileReferences`      | Reads `my_file_references` for a node                                           | Supabase-specific                                  |
| `downloadFileFromStorage`  | Downloads the asset blob from storage                                           | Supabase-specific                                  |
| `importAssetsForNode`      | Writes imported assets into the target vault and tracks imported asset mappings | Good candidate for Obsidian consumer adapter reuse |
| `updateMarkdownAssetLinks` | Rewrites note links to imported asset paths                                     | Good candidate for Obsidian consumer adapter reuse |

Important observation:

- Asset inclusion is already a real part of the current Obsidian sharing behavior, not a future nice-to-have.
- This strongly supports keeping assets in portable-package v0.
- What changes is the source of truth:
  - today it is `FileReference` plus storage download
  - with a portable package it should be the package asset manifest plus attached file payloads

## How relations are queried and imported today

### Local relation source of truth

Primary file:

- `apps/obsidian/src/utils/relationsStore.ts`

Current local relation storage is:

- `relations.json` at vault root
- endpoints stored as local node instance IDs or imported RIDs
- helper functions for resolving endpoints to actual Obsidian files

Important functions:

| Function                             | Scope today                                          | Portable-package relevance            |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------- |
| `loadRelations` / `saveRelations`    | Read and write `relations.json`                      | Reusable in Obsidian consumer adapter |
| `addRelationNoCheck` / `addRelation` | Materialize a relation locally                       | Reusable in Obsidian consumer adapter |
| `getRelationsForNodeInstanceId`      | Local relation lookup by node instance               | Local only                            |
| `resolveEndpointToFile`              | Resolve local endpoint IDs or imported RIDs to files | Strong reuse candidate                |
| `buildEndpointToFileMap`             | Batch endpoint-to-file map                           | Strong reuse candidate                |
| `getLocalNodeKeyToEndpointId`        | Build stable endpoint IDs for local nodes            | Strong reuse candidate                |
| `getImportedNodesInfo`               | Resolve imported nodes into stable keys and RIDs     | Strong reuse candidate                |

### Remote relation query and import

Primary file:

- `apps/obsidian/src/utils/importRelations.ts`

Current flow:

1. `fetchRelationInstancesFromSpace` queries `my_concepts` for non-schema concepts with `arity > 0`.
2. the importer reads `schema_id` to determine relation type.
3. endpoint concept IDs are resolved through `concepts_of_relation` and `reference_content`.
4. relation types are mapped to local settings with `mapRelationTypeToLocal`.
5. node types are mapped to local settings with `mapNodeTypeIdToLocal`.
6. missing triple schemas are created with `findOrCreateTriple`.
7. concrete local relation instances are created with `addRelationNoCheck`.

Important functions:

| Function                          | Scope today                                          | Portable-package relevance                                       |
| --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `fetchRelationInstancesFromSpace` | Queries remote relation instances from `my_concepts` | Should be replaced by reading relation payloads from the package |
| `importRelationsForImportedNodes` | Main relation import orchestrator                    | Good candidate to split into reusable consumer logic             |
| `mapRelationTypeToLocal`          | Maps remote relation type schema to local settings   | Strong reuse candidate                                           |
| `findOrCreateTriple`              | Creates missing local triple schemas                 | Strong reuse candidate                                           |
| `mapNodeTypeIdToLocal`            | Maps remote node type schema to local settings       | Strong reuse candidate                                           |

Important observation:

- `importRelationsForImportedNodes` mixes remote fetch concerns and local materialization concerns.
- For a portable package, this function should likely be split into:
  - package relation reader
  - local schema mapper
  - local relation materializer

## Full node import orchestration today

Primary entrypoint:

- `importSelectedNodes` in `importNodes.ts`

What it does:

1. groups selected nodes by source space
2. fetches source space URIs
3. imports node content and metadata
4. creates or updates local markdown files with `processFileContent`
5. imports assets with `importAssetsForNode`
6. rewrites asset links inside markdown
7. renames existing files if the title changed
8. imports relations where both endpoints resolve locally or were already imported

Important support functions:

| Function               | Scope today                                                                        | Portable-package relevance                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `processFileContent`   | Creates or updates Obsidian note files, maps node type IDs, sets `importedFromRid` | Strong reuse candidate in Obsidian consumer adapter                                    |
| `mapNodeTypeIdToLocal` | Maps source node type to a local node type                                         | Strong reuse candidate                                                                 |
| `computeImportPreview` | Precomputes relation and endpoint information for preview                          | Useful if the package importer still wants a preview step                              |
| `refreshImportedFile`  | Re-imports one file from remote source                                             | Could later be adapted to package-driven refresh if package source remains addressable |

## What can likely be reused

### Strong reuse candidates

These are the best candidates to survive into a portable-package implementation with little or moderate change:

- `mapNodeTypeIdToLocal`
- `mapRelationTypeToLocal`
- `findOrCreateTriple`
- `processFileContent`
- `importAssetsForNode`
- `updateMarkdownAssetLinks`
- `loadRelations`
- `saveRelations`
- `addRelationNoCheck`
- `resolveEndpointToFile`
- `buildEndpointToFileMap`
- `getLocalNodeKeyToEndpointId`
- `getImportedNodesInfo`
- RID helpers in `rid.ts` and `spaceFromRid.ts`

These are all good fits for an **Obsidian consumer adapter** for the portable package.

### Reusable patterns, but not necessarily the exact functions

- `orderConceptsByDependency`
- local-to-concept conversion patterns in `conceptConversion.ts`
- grouping imports by source space
- relation import only when both endpoints resolve locally
- asset import and markdown link rewriting as a second step after note creation

### Probably not reusable as package code

These are too tied to the current Supabase storage model:

- `getPublishedNodesForGroups`
- `fetchNodeContent`
- `fetchNodeContentWithMetadata`
- `fetchNodeContentForImport`
- `fetchFileReferences`
- `downloadFileFromStorage`
- `fetchRelationInstancesFromSpace`
- `publishNode`
- `publishNodeToGroup`
- `publishNodeRelations`
- `publishNewRelation`
- `ensurePublishedRelationsAccuracy`
- `upsertNodesToSupabaseAsContentWithEmbeddings`

These can remain in the system, but they are not good candidates for the portable package itself.

## What would need to change for a portable package

### 1. Replace Supabase-query-first import with package-first import

Today the importer asks Supabase:

- what nodes are available
- what content variants exist
- what file references exist
- what relations exist

With a portable package, the importer should instead read:

- bundled nodes
- bundled schemas
- bundled content
- bundled assets
- bundled relations

That means transport-facing functions in `importNodes.ts` and `importRelations.ts` should be refactored behind an input boundary that no longer assumes Supabase views.

### 2. Collapse internal content storage details into one portable content abstraction

Today import logic depends on:

- `direct` content for title
- `full` content for note body

That is an internal storage decision.

For a portable package, the public transport contract should expose one normalized `content` representation, likely `ATJSON`, and let the Obsidian consumer decide how to derive:

- note title
- note body
- any fidelity metadata needed in frontmatter

### 3. Separate remote fetch logic from local materialization logic

The current import code often combines:

- remote fetches from Supabase
- mapping to local settings
- writing to Obsidian local state

Portable package support will be simpler if those are split into layers:

- package reader
- Obsidian schema mapper
- Obsidian note writer
- Obsidian relation writer
- Obsidian asset writer

### 4. Keep current local Obsidian persistence in v0

Nothing in the current portable-package direction requires changing the local Obsidian model yet.

It is still reasonable in v0 for Obsidian to keep:

- markdown files plus frontmatter for node instances
- `relations.json` for relation instances
- imported assets in the vault filesystem

The first change should be the **transport format**, not the local persistence format.

## Main architectural takeaway

The current Obsidian-to-Obsidian flow already tells us what the portable package must contain:

- node identity
- schema identity
- node type metadata
- relation type metadata
- relation instances
- enough endpoint identity to reconnect relations locally
- content
- origin metadata
- file assets

The main thing it does **not** yet give us is a clean transport boundary. That is exactly where the portable package should fit.

The cleanest v0 approach is:

- keep current local Obsidian persistence
- keep current local-to-Supabase sync for now
- introduce a package producer and consumer layer
- reuse the local mapping and materialization helpers wherever possible
- replace Supabase-specific transport queries with portable-package readers
