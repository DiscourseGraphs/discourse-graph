# O. Schema to internal data layer

## Purpose

This is the compressed version of the data-layer reverse-engineering task.

It answers one question:

> How do Discourse Graph schema concepts map into the current internal data layer?

It intentionally excludes portable-package design, transport formats, API payloads, content-variant behavior, asset handling, and future refactors.

## Short answer

The current internal data layer represents both schema terms and graph instances with `Concept` rows.

The core rule is:

- schema objects are `Concept` rows where `is_schema = true`
- graph instances are `Concept` rows where `is_schema = false`
- `schema_id` links an instance to the schema `Concept` it instantiates
- `reference_content` stores role bindings for relation instances
- generated `refs` makes the referenced concepts queryable

There is no separate internal table for node schemas, relation schemas, node instances, relation instances, assertions, or edges.

## Sources of truth

Schema meaning comes from:

- `apps/website/public/schema/dg_base.ttl`
- `apps/website/public/schema/dg_core.ttl`

Current shared persistence comes from:

- `packages/database/supabase/schemas/concept.sql`

Local app models that feed the shared data layer come from:

- `apps/roam/src/utils/conceptConversion.ts`
- `apps/obsidian/src/utils/conceptConversion.ts`
- `apps/obsidian/src/utils/relationsStore.ts`
- `apps/roam/src/utils/createReifiedBlock.ts`

Generated TypeScript views over the shared model come from:

- `packages/database/src/dbTypes.ts`
- `packages/database/src/inputTypes.ts`

Treat `packages/database/schema.yaml` as historical design context, not the current implementation contract.

## One-table mapping

| Schema concept | Schema meaning | Current internal data-layer representation | Key fields | Caveat |
| -------------- | -------------- | ------------------------------------------ | ---------- | ------ |
| `dgb:NodeSchema` | A node type such as `Question`, `Claim`, `Evidence`, or source-like nodes | One `Concept` row | `is_schema=true`, `arity=0`, `name`, `source_local_id`, optional `literal_content` | Built-ins are not special tables or seeded canonical records. They sync as ordinary schema concepts. |
| `dgb:RelationDef` / relation schema | A relation type or predicate with roles | One `Concept` row | `is_schema=true`, `arity>0`, `literal_content.roles`, labels or relation metadata | Obsidian's typed relation/triple-schema distinction is local and collapses into `Concept` schema rows in shared persistence. |
| `dgb:Role`, including `dgb:source` and `dgb:destination` | A named position in a relation instance | Role names on the relation schema plus role bindings on relation instances | Schema: `literal_content.roles`; instance: `reference_content` keys | There is no separate shared `Role` table. |
| Node instance | A concrete discourse node | One `Concept` row linked to a node-schema `Concept` | `is_schema=false`, `schema_id`, `name`, `source_local_id`, optional `literal_content` | Human-readable content exists elsewhere; for this schema-to-data mapping, the semantic node is the `Concept`. |
| `dgb:RelationInstance` | A concrete assertion connecting concepts through a relation schema | One `Concept` row linked to a relation-schema `Concept` | `is_schema=false`, `schema_id`, `reference_content`, generated `refs` | This is the highest-risk mapping: relation instance means `Concept` plus `schema_id` plus `reference_content`, not an edge/assertion table. |
| Built-in terms such as `Question`, `Claim`, `Evidence` | Built-in node schemas in `dg_core.ttl` | Ordinary node-schema `Concept` rows when synced | Same as `dgb:NodeSchema` | The shared DB does not enforce a single canonical built-in vocabulary. |
| `Source` / `SourceDocument` | Source-like built-in node schema | Ordinary node-schema `Concept` rows when synced | Same as `dgb:NodeSchema` | TTL currently names `dg:SourceDocument`; app defaults commonly use `Source`. This is vocabulary drift, not a data-layer structure difference. |

## Relation instance mapping

This is the part most likely to cause confusion.

Conceptually, the schema says a relation instance is a statement-like thing with a predicate, source, and destination.

In the current shared data layer, that becomes:

```text
Concept {
  is_schema: false,
  schema_id: <db id of the relation schema Concept>,
  reference_content: {
    source: <db id of source Concept>,
    destination: <db id of destination Concept>
  },
  refs: <generated array of referenced Concept ids>
}
```

The actual role names can come from the relation schema's role list. Binary relations usually use `source` and `destination`.

## How local app data enters this model

Roam and Obsidian do not store graph data in identical local shapes. They converge when they create `LocalConceptDataInput` records for Supabase sync.

The sync path is:

```text
Roam or Obsidian local data
  -> LocalConceptDataInput
  -> concept_local_input
  -> _local_concept_to_db_concept(...)
  -> Concept row
```

Important conversion rules:

- `schema_represented_by_local_id` becomes `Concept.schema_id`
- `local_reference_content` becomes `Concept.reference_content`
- local IDs in `local_reference_content` are resolved to shared `Concept` database IDs
- `source_local_id` preserves the app-local identity used to upsert and reconnect records

## What is missing from the internal data layer

The current internal data layer does not have first-class shared tables for:

- node schema
- relation schema
- role
- relation instance
- assertion
- edge
- occurrence
- evidence/provenance attached to a relation instance

Those meanings are encoded through `Concept`, `schema_id`, `literal_content`, and `reference_content`.

## Minimal mental model

Use this model when implementing or reviewing schema-to-data work:

1. The TTL files define what the schema terms mean.
2. `Concept` is the shared internal record for both schema terms and instances.
3. `is_schema` tells you whether a `Concept` is a schema object or an instance.
4. `schema_id` tells you what schema an instance belongs to.
5. `reference_content` tells you which concepts fill a relation instance's roles.
6. Roam and Obsidian can differ locally, but sync should project their schema and instance data into this `Concept` shape.

