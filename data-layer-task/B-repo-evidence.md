# B. Repo evidence

## Database schema and migrations

### Current declarative schema

The current database source of truth is the declarative SQL schema under `packages/database/supabase/schemas/`.

- `packages/database/supabase/schemas/base.sql`
  - base enums and shared sequence, including `public."EntityType"`
- `packages/database/supabase/schemas/space.sql`
  - `public."Space"`
- `packages/database/supabase/schemas/account.sql`
  - `public."PlatformAccount"`
  - `public."AgentIdentifier"`
  - `public."LocalAccess"`
  - `public."SpaceAccess"`
  - `public.upsert_account_in_space`
  - `public.upsert_accounts_in_space`
- `packages/database/supabase/schemas/content.sql`
  - `public."Document"`
  - `public."Content"`
  - `public."ResourceAccess"`
  - `public.document_local_input`
  - `public.content_local_input`
  - `public._local_document_to_db_document`
  - `public._local_content_to_db_content`
  - `public.upsert_documents`
  - `public.upsert_content`
  - `public.can_view_specific_resource`
  - `public.my_accessible_resources`
- `packages/database/supabase/schemas/concept.sql`
  - `public."Concept"`
  - `public.concept_local_input`
  - `public._local_concept_to_db_concept`
  - `public.upsert_concepts`
  - `public.schema_of_concept`
  - `public.instances_of_schema`
  - `public.concept_in_relations`
  - `public.concepts_of_relation`
  - `public.content_of_concept`
  - `public.author_of_concept`
  - `public.rid_to_space_id_and_local_id`
  - `public.rid_or_local_id_to_concept_db_id`
- `packages/database/supabase/schemas/contributor.sql`
  - `public.content_contributors`
  - `public.concept_contributors`
- `packages/database/supabase/schemas/embedding.sql`
  - `public."ContentEmbedding_openai_text_embedding_3_small_1536"`
  - `public.upsert_content_embedding`
  - embedding match/search views and functions
- `packages/database/supabase/schemas/assets.sql`
  - `public."FileReference"`
  - `public.file_gc`
  - storage bucket policies
- `packages/database/supabase/schemas/sync.sql`
  - `public.sync_info`
  - `public.propose_sync_task`
  - `public.end_sync_task`

### Relevant migrations showing model evolution

- `packages/database/supabase/migrations/20250504202930_content_tables.sql`
  - older broader model with `Person`, `AutomatedAgent`, `Account`, `DiscoursePlatform`, `DiscourseSpace`, `represents_id`
- `packages/database/supabase/migrations/20250513173724_content_concept_key.sql`
  - moved between explicit content-to-concept linkage strategies
- `packages/database/supabase/migrations/20250526150535_uniqueness.sql`
  - tightened uniqueness around local IDs
- `packages/database/supabase/migrations/20250718131540_content_variant.sql`
  - introduced `ContentVariant` and variant-aware uniqueness
- `packages/database/supabase/migrations/20260102140646_content_and_concept_access_tables.sql`
  - older separate `ContentAccess` and `ConceptAccess`
- `packages/database/supabase/migrations/20260117210851_unify_concept_content_access_tables.sql`
  - unified access into `ResourceAccess`
- `packages/database/supabase/migrations/20260118210851_fileref.sql`
  - introduced `FileReference`
- `packages/database/supabase/migrations/20260221193625_rid_functions.sql`
  - RID resolution functions

## Generated and hand-written model/type definitions

- `packages/database/src/dbTypes.ts`
  - generated TypeScript model of the current SQL schema
- `packages/database/src/inputTypes.ts`
  - exported TypeScript aliases for local-to-DB composite inputs:
    - `LocalAccountDataInput`
    - `LocalDocumentDataInput`
    - `LocalContentDataInput`
    - `LocalConceptDataInput`

## Database-facing query and mapping code

- `packages/database/src/lib/queries.ts`
  - main query API over `Concept`
  - distinguishes nodes vs relations via `arity == 0` vs `arity > 0`
  - uses computed relationships `content_of_concept`, `concept_in_relations`, `concepts_of_relation`
- `packages/database/src/lib/contextFunctions.ts`
  - space creation/login and platform-account creation in a space
- `packages/database/src/lib/files.ts`
  - maps binary file uploads to storage plus `FileReference`

## Roam local persistence and mapping

### Local node and relation definitions

- `apps/roam/src/utils/getDiscourseNodes.ts`
  - `type DiscourseNode`
  - node schemas come from the Roam config page tree and block props
- `apps/roam/src/utils/getDiscourseRelations.ts`
  - `type DiscourseRelation`
  - relation definitions come from the grammar subtree

### Reified relation storage

- `apps/roam/src/utils/createReifiedBlock.ts`
  - stores relation instances as hidden-prop blocks under `roam/js/discourse-graph/relations`
  - prop namespace is `discourse-graph`
  - stores `hasSchema`, `sourceUid`, `destinationUid`, and other role UID bindings
- `apps/roam/src/utils/migrateRelations.ts`
  - migration from legacy pattern-derived relations to stored relations
- `apps/roam/src/utils/storedRelations.ts`
  - feature-flag style helpers around stored relation mode

### Roam to Supabase mapping

- `apps/roam/src/utils/conceptConversion.ts`
  - `discourseNodeSchemaToLocalConcept`
  - `discourseNodeBlockToLocalConcept`
  - `discourseRelationSchemaToLocalConcept`
  - `discourseRelationDataToLocalConcept`
- `apps/roam/src/utils/upsertNodesAsContentWithEmbeddings.ts`
  - maps Roam nodes to `content_local_input`
- `apps/roam/src/utils/syncDgNodesToSupabase.ts`
  - current sync entrypoint
  - primary concept sync path currently handles node schemas and node instances

### Roam transport/export

- `apps/roam/src/utils/jsonld.ts`
  - JSON-LD export with `@context`, `@graph`, `dgb:RelationInstance`, `rdf:predicate`, `prov:generatedAtTime`
- `apps/roam/src/utils/exportUtils.ts`
- `apps/roam/src/utils/importDiscourseGraph.ts`

## Obsidian local persistence and mapping

### Local model types

- `apps/obsidian/src/types.ts`
  - `DiscourseNode`
  - `DiscourseRelationType`
  - `DiscourseRelation`
  - `RelationInstance`
  - `Settings`
- `apps/obsidian/src/constants.ts`
  - default node types: `Question`, `Claim`, `Evidence`, `Source`
  - default relation types: `supports`, `opposes`, `informs`, `derivedFrom`
  - default `discourseRelations` triple schemas

### Local persisted records

- markdown files with frontmatter
  - node instance IDs are ensured by `apps/obsidian/src/utils/nodeInstanceId.ts`
- `apps/obsidian/src/utils/relationsStore.ts`
  - relation instance source of truth is `relations.json`
  - `type RelationsFile`

### Obsidian to Supabase mapping

- `apps/obsidian/src/utils/conceptConversion.ts`
  - `discourseNodeSchemaToLocalConcept`
  - `discourseRelationTypeToLocalConcept`
  - `discourseRelationTripleSchemaToLocalConcept`
  - `discourseNodeInstanceToLocalConcept`
  - `relationInstanceToLocalConcept`
- `apps/obsidian/src/utils/upsertNodesAsContentWithEmbeddings.ts`
  - generates `direct` and `full` content variants
- `apps/obsidian/src/utils/syncDgNodesToSupabase.ts`
  - syncs node schemas, relation type schemas, triple schemas, node instances, and relation instances

### Publish/import and transport helpers

- `apps/obsidian/src/utils/publishNode.ts`
  - publishes nodes, relations, schemas, and files using `ResourceAccess` and `FileReference`
- `apps/obsidian/src/utils/importNodes.ts`
  - imports content/files from shared persistence
- `apps/obsidian/src/utils/rid.ts`
  - RID conversion helpers

## Ontology/schema and transport definitions

- `apps/website/public/schema/dg_base.ttl`
  - conceptual ontology foundation
  - defines `dgb:NodeSchema`, `dgb:RelationDef`, `dgb:RelationInstance`
- `apps/website/public/schema/dg_core.ttl`
  - conceptual vocabulary for `Question`, `Claim`, `Evidence`, `Source` and built-in relations
- `packages/database/schema.yaml`
  - older LinkML-style semantic model, partly aligned and partly stale relative to current SQL

## API and transport-facing code

- `apps/website/app/api/supabase/content/route.ts`
- `apps/website/app/api/supabase/content/batch/route.ts`
- `apps/website/app/api/supabase/document/route.ts`
- `apps/website/app/api/supabase/agent-identifier/route.ts`
- `apps/website/app/api/supabase/content-embedding/batch/route.ts`
- `apps/website/app/api/supabase/space/route.ts`
- `apps/website/app/utils/supabase/dbUtils.ts`
- `apps/website/app/utils/supabase/validators.ts`

These routes expose DB tables and batch upserts directly enough that transport payloads can easily be mistaken for the canonical data model. They are transport adapters over the SQL model, not the model itself.

## Tests and design notes that reveal intended semantics

- `packages/database/features/queryConcepts.feature`
  - explicit test evidence that relation instances are stored as `Concept` rows with `reference_content`
- `packages/database/features/addConcepts.feature`
- `packages/database/features/getContext.feature`
- `packages/database/doc/concept_example.md`
  - explicit design note about relation occurrences and possible future materialization
- `packages/database/doc/upsert_content.md`
- `packages/database/doc/sync_functions.md`
