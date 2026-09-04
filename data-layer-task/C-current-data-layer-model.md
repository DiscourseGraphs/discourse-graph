# C. Current data layer model

## 1. Shared Supabase persisted model

This is the closest thing to the current cross-product canonical data layer.

### Identity, ownership, and access

| Record            | Where defined                                    | What it stores                                                        | Notes                                                                                          |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Space`           | `packages/database/supabase/schemas/space.sql`   | Shared graph/vault identity by `id`, `url`, `name`, `platform`        | Space-scoped namespace for all synced records                                                  |
| `PlatformAccount` | `packages/database/supabase/schemas/account.sql` | Platform-local user/account identity                                  | Stores `account_local_id`, `platform`, `name`, `agent_type`, `metadata`, optional `dg_account` |
| `AgentIdentifier` | `packages/database/supabase/schemas/account.sql` | Secondary identifiers such as email and ORCID                         | Unification helper, not a person model                                                         |
| `LocalAccess`     | `packages/database/supabase/schemas/account.sql` | Which platform accounts have used a space                             | Local usage record                                                                             |
| `SpaceAccess`     | `packages/database/supabase/schemas/account.sql` | Shared access to a whole space                                        | Permission enum is now `partial`, `reader`, `editor`                                           |
| `ResourceAccess`  | `packages/database/supabase/schemas/content.sql` | Shared access to a specific resource by `(space_id, source_local_id)` | Used for both concept-like and content-like resources                                          |

### Content and source documents

| Record                                                | Where defined                                      | What it stores                                    | Notes                                                                               |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Document`                                            | `packages/database/supabase/schemas/content.sql`   | A source document/container                       | Identified by `(space_id, source_local_id)` or `url`; may hold raw `contents` OID   |
| `Content`                                             | `packages/database/supabase/schemas/content.sql`   | Textual representation unit                       | Has `variant`, `scale`, `metadata`, author/creator, parent content, and document FK |
| `FileReference`                                       | `packages/database/supabase/schemas/assets.sql`    | File attachment metadata keyed by source resource | References a `Content` row by `(space_id, source_local_id, variant='full')`         |
| `ContentEmbedding_openai_text_embedding_3_small_1536` | `packages/database/supabase/schemas/embedding.sql` | Embedding vector for a content row                | One embedding row per content row                                                   |

### Concepts and graph semantics

| Record                 | Where defined                                        | What it stores                                                     | Notes                     |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| `Concept`              | `packages/database/supabase/schemas/concept.sql`     | Node schemas, relation schemas, node instances, relation instances | Main semantic record type |
| `concept_contributors` | `packages/database/supabase/schemas/contributor.sql` | Additional contributors to a concept                               | Operational join table    |
| `content_contributors` | `packages/database/supabase/schemas/contributor.sql` | Additional contributors to content                                 | Operational join table    |

### Operational state

| Record      | Where defined                                   | What it stores                                     | Notes                                   |
| ----------- | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| `sync_info` | `packages/database/supabase/schemas/sync.sql`   | Sync worker state, timeouts, backoff, last success | Operational task table, not domain data |
| `file_gc`   | `packages/database/supabase/schemas/assets.sql` | Deferred blob garbage collection                   | Operational table                       |

## 2. The `Concept` table is the semantic center

`public."Concept"` is currently doing the work that, in a more specialized model, would likely be split across:

- node schema records
- relation schema records
- node instances
- assertion or relation-instance records
- some provenance-bearing statement model

Its relevant columns are:

- `id`
- `epistemic_status`
- `name`
- `description`
- `author_id`
- `created`
- `last_modified`
- `space_id`
- `schema_id`
- `literal_content`
- `reference_content`
- `is_schema`
- `source_local_id`
- generated `arity`
- generated `refs`

### Current interpretation by row shape

| Row kind          | `is_schema` | `arity` | `schema_id`               | `reference_content`         | Interpretation                            |
| ----------------- | ----------- | ------- | ------------------------- | --------------------------- | ----------------------------------------- |
| Node schema       | `true`      | `0`     | `NULL`                    | usually `{}`                | A node type such as Claim or Evidence     |
| Relation schema   | `true`      | `> 0`   | `NULL`                    | sometimes schema references | A relation type or relation triple schema |
| Node instance     | `false`     | `0`     | points to node schema     | `{}` or ad hoc JSON         | A concrete discourse node                 |
| Relation instance | `false`     | `> 0`   | points to relation schema | role bindings               | A concrete assertion/edge-like object     |

### How `arity` is computed

`arity` is not manually stored. It is generated by `compute_arity_local(schema_id, literal_content)`:

- for a schema row, from `literal_content->'roles'`
- for an instance row, from the referenced schema row's `literal_content->'roles'`

That implementation detail matters because the codebase uses `arity` as the practical discriminator between node-like and relation-like concepts:

- `packages/database/src/lib/queries.ts`
  - node queries filter `arity = 0`
  - relation queries filter `arity > 0`

## 3. How relations are represented internally

## 3.1 In shared Supabase persistence

There is no `Edge`, `Assertion`, or `RelationInstance` table. A relation instance is represented as:

- one `Concept` row for the relation instance
- `schema_id` pointing to the relation schema concept
- `reference_content` holding the role bindings
- generated `refs` holding the referenced concept IDs for indexing/querying

### Example shape

A relation instance concept typically looks like:

- `is_schema = false`
- `schema_id = <relation schema concept id>`
- `reference_content = {"source": <concept id>, "destination": <concept id>}`

The exact role names are schema-defined. They are taken from `literal_content.roles` on the relation schema concept.

### Relation metadata

Relation instance metadata currently lives in the same general-purpose places as node metadata:

- `author_id`
- `created`
- `last_modified`
- `name`
- `description`
- `epistemic_status`
- optional ad hoc JSON inside `literal_content`

There is no dedicated structure for:

- assertion provenance
- evidence linkage
- occurrence spans
- quoting/snippet anchoring
- certainty per participant binding
- per-edge publication/import state in shared persistence

## 3.2 In Obsidian local persistence

Obsidian has a clearer local graph model before sync:

- node type schemas: `Settings.nodeTypes`
- relation type schemas: `Settings.relationTypes`
- relation triple schemas: `Settings.discourseRelations`
- node instances: markdown files with frontmatter
- relation instances: `relations.json`

`apps/obsidian/src/types.ts` defines:

- `DiscourseNode`
- `DiscourseRelationType`
- `DiscourseRelation`
- `RelationInstance`

`RelationInstance` carries richer local metadata than the shared Supabase model:

- `id`
- `type`
- `source`
- `destination`
- `created`
- `author`
- optional `lastModified`
- optional `publishedToGroupId`
- optional `importedFromRid`

On sync, `apps/obsidian/src/utils/conceptConversion.ts` maps this to `LocalConceptDataInput`:

- `schema_represented_by_local_id = type`
- `local_reference_content = { source, destination }`
- `literal_content` may carry `importedFromRid`

## 3.3 In Roam local persistence

Roam currently has two relation representations:

### Legacy/query-derived relations

- relation definitions come from the grammar config tree in `apps/roam/src/utils/getDiscourseRelations.ts`
- actual relation instances can still be inferred from graph patterns and query logic in `apps/roam/src/utils/getRelationData.ts`

### Stored/reified relations

- stored under the page `roam/js/discourse-graph/relations`
- each relation instance is a Roam block created by `apps/roam/src/utils/createReifiedBlock.ts`
- the block text is a generated UID
- hidden block props under the `discourse-graph` key carry:
  - `hasSchema`
  - `sourceUid`
  - `destinationUid`
  - additional role bindings if needed

`apps/roam/src/utils/conceptConversion.ts` can map those stored relations into `LocalConceptDataInput`, but the main sync path in `apps/roam/src/utils/syncDgNodesToSupabase.ts` currently emphasizes node schemas and node instances.

## 4. How claims, evidence, questions, sources, and similar concepts are represented

## Built-in discourse kinds

The codebase has built-in discourse vocabulary for:

- `Question`
- `Claim`
- `Evidence`
- `Source`

Evidence:

- conceptual ontology in `apps/website/public/schema/dg_core.ttl`
- default Obsidian node types in `apps/obsidian/src/constants.ts`
- Roam config-driven node definitions in `apps/roam/src/utils/getDiscourseNodes.ts`

## Shared persisted representation

Those built-ins are represented in Supabase as ordinary `Concept` schema rows, not special tables or enums.

That means:

- a Claim type is a `Concept` schema
- a claim instance is a `Concept` instance row
- evidence, questions, and sources work the same way

## Experiments, issues, results, and similar domain concepts

I did not find dedicated database tables, enums, or shared TS model types for:

- Experiment
- Issue
- Result

`Result` appears in docs and UI code mostly as a query-result type, not as a persisted discourse entity class. If those concepts exist today, they are represented as user-defined node schemas and node instances rather than first-class built-ins in the shared persisted model.

## 5. How IDs are assigned and referenced

### Shared Supabase IDs

- most persisted tables use `bigint` IDs from `public.entity_id_seq`
- `Concept.id`, `Content.id`, `Document.id`, `PlatformAccount.id`, `Space.id` are DB-native numeric IDs

### Stable local identity

Cross-system identity is mostly anchored on `source_local_id`, scoped by `space_id`.

Examples:

- `Concept` unique on `(space_id, source_local_id)` when non-null
- `Content` unique on `(space_id, source_local_id, variant)`
- `Document` unique on `(space_id, source_local_id)`
- `ResourceAccess` keyed by `(account_uid, source_local_id, space_id)`

### Local app IDs

- Roam uses page/block UIDs
- Obsidian node instances use `uuidv7` via `apps/obsidian/src/utils/nodeInstanceId.ts`
- Obsidian schema/type IDs are generated plugin IDs
- Obsidian relation instances use `uuidv7` in `relations.json`

### Cross-space transport IDs

RID/ORN-like transport identifiers are handled by:

- `public.rid_to_space_id_and_local_id`
- `public.rid_or_local_id_to_concept_db_id`
- `apps/obsidian/src/utils/rid.ts`

These are transport/interchange identifiers. They are not the primary stored identity in the shared model.

## 6. What acts as source of truth

## Shared source of truth

For the shared backend, the main source-of-truth tables are:

- `Space`
- `PlatformAccount`
- `Document`
- `Content`
- `Concept`
- `ResourceAccess`
- `FileReference`

There is no ORM model layer on top of this. The actual model is defined by:

- SQL schema files
- generated `dbTypes.ts`
- composite input types and mapping functions

## Client-local source of truth

### Obsidian

- settings JSON for schemas
- markdown files and frontmatter for node instances
- `relations.json` for relation instances

### Roam

- the Roam graph itself
- discourse config page tree and block props for schemas
- page/block UIDs for node instances
- optionally stored reified relation blocks

## 7. Denormalized and derived representations

### In the database

- `Concept.arity` generated from role definitions
- `Concept.refs` generated from `reference_content`
- `my_concepts`, `my_contents`, `my_documents`, `my_file_references`, `my_groups`
- `my_contents_with_embedding_openai_text_embedding_3_small_1536`
- vector match functions for content embeddings

### In application code

- `packages/database/src/lib/queries.ts` caches schema concepts in `NODE_SCHEMA_CACHE`
- client sync code generates local composite inputs before RPC upsert
- Roam JSON-LD export and Obsidian import/export are derived views of internal records, not canonical stored forms

## 8. Important implementation detail: concepts and content are linked indirectly

The old explicit concept-to-content representation link is gone from the current table schema. Instead, `public.content_of_concept(concept public.my_concepts)` returns content rows by:

- matching `cnt.space_id = concept.space_id`
- matching `cnt.source_local_id = concept.source_local_id`

That means the shared model currently treats aligned local IDs as the concept/content join mechanism, not a dedicated foreign key.

## 9. Important concept crosswalk

| Important concept               | Main code locations                                                                                                                                                                                                                | Shared DB table or local store                                                                                        | Main model/type definitions                                                                                 | Main serialization or export path                                               | Primary layer |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Space                           | `packages/database/supabase/schemas/space.sql`, `packages/database/src/lib/contextFunctions.ts`, `apps/website/app/api/supabase/space/route.ts`                                                                                    | `public."Space"`                                                                                                      | generated `Tables<"Space">` in `packages/database/src/dbTypes.ts`                                           | Next API `/api/supabase/space`                                                  | Data          |
| Platform account                | `packages/database/supabase/schemas/account.sql`, `packages/database/src/lib/contextFunctions.ts`                                                                                                                                  | `public."PlatformAccount"`, `public."AgentIdentifier"`                                                                | generated `Tables<"PlatformAccount">`, `Tables<"AgentIdentifier">`                                          | API route for `agent-identifier`; account creation RPCs                         | Data          |
| Node schema                     | `packages/database/supabase/schemas/concept.sql`, `apps/obsidian/src/utils/conceptConversion.ts`, `apps/roam/src/utils/conceptConversion.ts`                                                                                       | `public."Concept"` row with `is_schema=true`, `arity=0`; local config/settings                                        | `LocalConceptDataInput`, Obsidian `DiscourseNode`, Roam `DiscourseNode`                                     | Roam JSON-LD node schema export; client sync RPC `upsert_concepts`              | Data          |
| Relation schema                 | `packages/database/supabase/schemas/concept.sql`, `apps/obsidian/src/utils/conceptConversion.ts`, `apps/roam/src/utils/conceptConversion.ts`                                                                                       | `public."Concept"` row with `is_schema=true`, `arity>0`; local relation settings/config                               | `LocalConceptDataInput`, Obsidian `DiscourseRelationType` and `DiscourseRelation`, Roam `DiscourseRelation` | Roam JSON-LD `relationDef`; sync RPC `upsert_concepts`                          | Data          |
| Node instance                   | `packages/database/supabase/schemas/concept.sql`, `packages/database/supabase/schemas/content.sql`, `apps/obsidian/src/utils/syncDgNodesToSupabase.ts`, `apps/roam/src/utils/syncDgNodesToSupabase.ts`                             | `public."Concept"`, `public."Content"`, `public."Document"`; local markdown/frontmatter or Roam page/block            | `LocalConceptDataInput`, `LocalContentDataInput`, Obsidian frontmatter shape, Roam node query records       | API content/document routes; Roam JSON-LD node export; import/export note flows | Data          |
| Relation instance               | `packages/database/supabase/schemas/concept.sql`, `packages/database/src/lib/queries.ts`, `apps/obsidian/src/utils/relationsStore.ts`, `apps/obsidian/src/utils/conceptConversion.ts`, `apps/roam/src/utils/createReifiedBlock.ts` | shared `public."Concept"` row with `schema_id` and `reference_content`; local `relations.json` or Roam reified blocks | `LocalConceptDataInput`, Obsidian `RelationInstance`, Roam hidden block-prop object                         | Roam JSON-LD `relationInstance`; Obsidian publish/import flows                  | Data          |
| Content/document representation | `packages/database/supabase/schemas/content.sql`, `packages/database/src/lib/files.ts`, `apps/obsidian/src/utils/upsertNodesAsContentWithEmbeddings.ts`, `apps/roam/src/utils/upsertNodesAsContentWithEmbeddings.ts`               | `public."Document"`, `public."Content"`, `public."FileReference"`                                                     | `LocalDocumentDataInput`, `LocalContentDataInput`                                                           | API content/document routes; Obsidian import/publish; Roam export               | Data          |
| Access control                  | `packages/database/supabase/schemas/account.sql`, `packages/database/supabase/schemas/content.sql`, `apps/obsidian/src/utils/publishNode.ts`                                                                                       | `public."SpaceAccess"`, `public."ResourceAccess"`, `public."LocalAccess"`                                             | generated table types in `dbTypes.ts`                                                                       | publish/import flows and access-filtered views                                  | Data          |
| RID / import origin             | `packages/database/supabase/schemas/concept.sql`, `apps/obsidian/src/utils/rid.ts`, `apps/obsidian/src/utils/importNodes.ts`                                                                                                       | resolved into `(space_id, source_local_id)`; sometimes stored ad hoc in local/frontmatter or `literal_content`        | local string fields such as `importedFromRid`                                                               | RID strings in import/export flows                                              | Transport     |
| Conceptual vocabulary           | `apps/website/public/schema/dg_base.ttl`, `apps/website/public/schema/dg_core.ttl`, `packages/database/schema.yaml`                                                                                                                | no dedicated live table beyond synced concept rows                                                                    | TTL classes and LinkML classes                                                                              | Turtle and JSON-LD schema export                                                | Schema        |
