# I. Current layer architecture note

## Purpose

This note defines the current Discourse Graph schema layer, data layer, and transport layer as implemented in this repo today.

It is intentionally about the current implementation, not the ideal future architecture.

## Short answer

The current system is best understood as three layers:

- **Schema layer**: the conceptual discourse vocabulary
- **Data layer**: the persisted internal records and client-local stores that instantiate that vocabulary
- **Transport layer**: the API, export, RID, and future portable-package representations derived from the internal records

The current shared persisted semantic center is:

- `Concept` for semantic entities
- `Content` for textual representations
- `Document` for source containers

## Precedence rule

Use this rule when artifacts disagree:

1. For **conceptual meaning**, prefer the TTL schema files.
2. For **current shared persisted implementation**, prefer the declarative SQL schema.
3. For **current client-local implementation**, prefer the active Roam and Obsidian local stores plus their sync conversion code.
4. For **wire formats and exports**, treat API payloads, JSON-LD, RID helpers, and later portable-package shapes as downstream projections, not canonical internal truth.
5. Treat `packages/database/schema.yaml` and older migrations as design context or history, not as the authoritative description of the live implementation where they conflict with current SQL.

## Schema layer

### Definition

The schema layer defines the discourse concepts and relations the system talks about. It answers questions like:

- what is a node schema
- what is a relation definition
- what is a relation instance conceptually
- what built-in concepts such as `Claim` or `Evidence` mean

### Authoritative artifacts

- `apps/website/public/schema/dg_base.ttl`
- `apps/website/public/schema/dg_core.ttl`

### Supporting but non-authoritative artifacts

- `packages/database/schema.yaml`

`schema.yaml` still contains useful design intent, but it should not be treated as the live implementation model when it differs from the SQL schema.

## Data layer

### Definition

The data layer is the set of internal persisted records and client-local stores that instantiate schema concepts in the product.

The current data layer has two tiers:

1. client-local persistence in Roam and Obsidian
2. shared normalized persistence in Supabase

### Shared persisted data layer

The authoritative shared persisted model is the declarative SQL schema under:

- `packages/database/supabase/schemas/base.sql`
- `packages/database/supabase/schemas/space.sql`
- `packages/database/supabase/schemas/account.sql`
- `packages/database/supabase/schemas/content.sql`
- `packages/database/supabase/schemas/concept.sql`
- `packages/database/supabase/schemas/contributor.sql`
- `packages/database/supabase/schemas/embedding.sql`
- `packages/database/supabase/schemas/assets.sql`
- `packages/database/supabase/schemas/sync.sql`

The most important shared data-layer records are:

- `Space`
- `PlatformAccount`
- `AgentIdentifier`
- `LocalAccess`
- `SpaceAccess`
- `ResourceAccess`
- `Document`
- `Content`
- `Concept`
- `FileReference`
- contributor joins
- embeddings
- `sync_info`

### Practical interpretation of the shared model

For the current implementation:

- `Concept` is the canonical shared semantic record
- `Content` is the canonical shared textual representation record
- `Document` is the canonical shared source-container record

The current shared model does **not** have a dedicated assertion or edge table. Relation instances are currently represented as `Concept` rows with:

- `is_schema = false`
- `schema_id` pointing to a relation schema
- `reference_content` holding role bindings

### Generated and code-facing data-layer artifacts

These are derived from or tightly coupled to the SQL model and should be treated as code-facing views of the data layer rather than a separate source of truth:

- `packages/database/src/dbTypes.ts`
- `packages/database/src/inputTypes.ts`
- `packages/database/src/lib/queries.ts`
- `packages/database/src/lib/contextFunctions.ts`
- `packages/database/src/lib/files.ts`

### Client-local data layer

Roam and Obsidian each have local persistence that feeds the shared model. Those local stores are part of the current data layer because they are upstream internal representations, not transport-only projections.

#### Roam authoritative artifacts

- `apps/roam/src/utils/getDiscourseNodes.ts`
- `apps/roam/src/utils/getDiscourseRelations.ts`
- `apps/roam/src/utils/createReifiedBlock.ts`
- `apps/roam/src/utils/conceptConversion.ts`
- `apps/roam/src/utils/syncDgNodesToSupabase.ts`

#### Obsidian authoritative artifacts

- `apps/obsidian/src/types.ts`
- `apps/obsidian/src/constants.ts`
- `apps/obsidian/src/utils/relationsStore.ts`
- `apps/obsidian/src/utils/conceptConversion.ts`
- `apps/obsidian/src/utils/syncDgNodesToSupabase.ts`

## Transport layer

WIP - this section is not complete.

### Definition

The transport layer is the set of representations used to move, export, import, publish, or expose data outside the internal persisted model.

It answers questions like:

- what goes over HTTP
- what gets exported as JSON-LD
- how cross-space IDs are represented
- what a future portable package should consume or emit

### Current transport artifacts

- `apps/website/app/api/supabase/*`
- `apps/website/app/utils/supabase/dbUtils.ts`
- `apps/website/app/utils/supabase/validators.ts`
- `apps/roam/src/utils/jsonld.ts`
- `apps/roam/src/utils/exportUtils.ts`
- `apps/roam/src/utils/importDiscourseGraph.ts`
- `apps/obsidian/src/utils/importNodes.ts`
- `apps/obsidian/src/utils/publishNode.ts`
- `apps/obsidian/src/utils/rid.ts`

### Transport rule

API payloads, JSON-LD objects, RID strings, and the future portable package should be described as projections over the current internal model. They are not the canonical definition of the schema layer or the data layer.

## What is authoritative vs not

### Authoritative for current conceptual meaning

- `apps/website/public/schema/dg_base.ttl`
- `apps/website/public/schema/dg_core.ttl`

### Authoritative for current shared persisted implementation

- `packages/database/supabase/schemas/*.sql`

### Authoritative for current local app implementation

- the active Roam and Obsidian local model and sync files listed above

### Helpful but not authoritative for the live model

- `packages/database/schema.yaml`
- old migration files when they conflict with declarative schema
- design notes such as `packages/database/doc/concept_example.md`
- examples such as `packages/database/doc/upsert_content.md`
- operational notes such as `packages/database/doc/sync_functions.md`
- API route payload shapes

## Reusable working definition

Use this wording in v0 documentation unless and until the implementation changes:

> The current Discourse Graph data layer consists of client-local Roam and Obsidian persistence plus the shared Supabase persistence model they sync into. The schema layer is defined conceptually by the TTL vocabulary in `dg_base.ttl` and `dg_core.ttl`. The shared data layer is centered on `Concept`, `Content`, and `Document`, with supporting access, identity, file, embedding, and sync records. The transport layer consists of API payloads, RID-based identifiers, JSON-LD export, and future portable-package representations that are derived from, rather than authoritative over, the internal model.

## Immediate implications

- Do not describe API payloads as if they were the canonical data model.
- Do not describe `schema.yaml` as if it were the live database model.
- Do describe `Concept` as the current shared semantic center, even though that is not necessarily the desired long-term abstraction.
- Do call out client-local Roam and Obsidian divergence when discussing the current data layer, especially for relation instances.
