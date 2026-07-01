# A. Executive summary

## Bottom line

The repo currently implements a shared Supabase-backed data layer, but it does not have a single uniform internal model across all products. There are really two levels of internal persistence:

- Client-local persistence in Roam and Obsidian.
- Shared persisted records in Supabase.

The shared Supabase model is the closest thing to a canonical cross-product data layer. Its core persisted records are:

- `Space`, `PlatformAccount`, `AgentIdentifier`, `LocalAccess`, `SpaceAccess`
- `Document`, `Content`
- `Concept`
- `ResourceAccess`, `FileReference`
- `content_contributors`, `concept_contributors`
- `ContentEmbedding_openai_text_embedding_3_small_1536`
- `sync_info`

## Most important finding

The current system does **not** persist graph edges or assertions in a dedicated edge table. Instead:

- Node schemas, relation schemas, node instances, and relation instances are all stored in `public."Concept"`.
- A relation instance is represented as a `Concept` row whose generated `arity` is greater than `0`.
- The relation type is carried by `schema_id`.
- The bound participants are stored in `reference_content` as JSON role bindings, with a generated `refs BIGINT[]` index extracted from that JSON.

This means "relation as first-class object" is only partially implemented:

- Yes in the sense that relation instances are stored as rows with IDs, authorship, timestamps, and schema/type.
- No in the sense that there is no dedicated `Assertion`, `Edge`, `Statement`, `Occurrence`, or provenance table in Supabase.

## What is schema vs data vs transport

- Schema layer: the conceptual discourse vocabulary in `apps/website/public/schema/dg_base.ttl` and `apps/website/public/schema/dg_core.ttl`, plus some legacy modeling intent in `packages/database/schema.yaml`.
- Data layer: the SQL schema in `packages/database/supabase/schemas/*.sql`, generated types in `packages/database/src/dbTypes.ts`, input composites in `packages/database/src/inputTypes.ts`, and the client-local stores in Roam and Obsidian.
- Transport layer: Next.js API routes under `apps/website/app/api/supabase/*`, Roam JSON-LD export in `apps/roam/src/utils/jsonld.ts`, RID helpers in `apps/obsidian/src/utils/rid.ts`, and import/export flows.

## Built-in discourse concepts

`Question`, `Claim`, `Evidence`, and `Source` are **not** dedicated database tables. They currently exist as:

- Ontology classes in `apps/website/public/schema/dg_core.ttl`
- Default plugin node types in `apps/obsidian/src/constants.ts`
- Config-driven node definitions in Roam

So they are schema concepts and seeded configuration, not first-class DB model classes.

## Product divergence

Obsidian and Roam do not project equally into the shared data layer:

- Obsidian sync materializes node schemas, relation type schemas, relation triple schemas, node instances, and relation instances into Supabase `Concept` rows.
- Roam has local support for stored/reified relation blocks in `apps/roam/src/utils/createReifiedBlock.ts`, but the current sync path in `apps/roam/src/utils/syncDgNodesToSupabase.ts` primarily upserts node schemas and node instances.

## Main architectural implication

The present data layer is best defined as:

1. A client-local discourse model in each app.
2. A shared normalized persistence model in Supabase centered on `Concept`, `Content`, and `Document`.
3. A set of transport/export projections that are downstream of those internal structures.

The main gap between current and intended state is that the conceptual ontology treats relation instances more like first-class statements with room for provenance and evidence metadata, while the implemented shared data layer still encodes them as generic `Concept` rows with JSON role bindings.
