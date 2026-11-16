# N. Cross-app interchange folder structure

## Summary

This note proposes a common folder structure for the cross-app interchange abstraction.

The goal is:

- identical top-level interchange structure in each app
- app-specific implementations at the edges
- shared DB-centered logic in one package
- clearer mapping from the current Obsidian and Roam code into the future pipeline

The key design choice is that not every phase belongs inside each app.

- `ingest`, `share`, and `materialize` are app-facing phases
- `persist`, `extract`, and `serialize` are shared DB-facing phases

That means each app should expose the same interchange folder layout, while the database-centered phases should live in a shared package.

## Proposed structure

### App structure

Both `apps/obsidian` and `apps/roam` should eventually expose the same interchange layout:

```text
src/
  interchange/
    host/
      reads.ts
      writes.ts
      identity.ts
      context.ts
    ingest/
      collectNodes.ts
      collectSchemas.ts
      collectRelations.ts
      collectAssets.ts
      buildContentInputs.ts
      buildConceptInputs.ts
      runIngest.ts
    share/
      buildShareSelection.ts
      shareNodes.ts
      shareSchemas.ts
      shareRelations.ts
      shareAssets.ts
      runShare.ts
    materialize/
      previewSubgraph.ts
      applyNodes.ts
      applySchemas.ts
      applyRelations.ts
      applyAssets.ts
      runMaterialize.ts
    types.ts
    index.ts
```

### Shared package structure

The DB-centered phases should live in one shared package:

```text
packages/
  interchange/
    src/
      persist/
        upsertContent.ts
        upsertConcepts.ts
        embeddings.ts
      extract/
        extractSubgraph.ts
        resolveNodes.ts
        resolveRelations.ts
        resolveSchemas.ts
        resolveAssets.ts
      serialize/
        toPortablePackage.ts
      types/
        subgraph.ts
        shareSelection.ts
      index.ts
```

## Why this split

The app folders should own host-specific behavior:

- Obsidian vault reads and writes
- Roam page and block reads and writes
- Obsidian frontmatter handling
- Roam block tree and datalog handling
- asset lookup inside the host app

The shared package should own DB-centered behavior:

- `upsert_content`
- `upsert_concepts`
- embedding helpers
- extracting a shared subgraph from the DB
- serializing that subgraph into a portable package

This keeps the pipeline legible:

```text
source app
  -> app/interchange/ingest/runIngest
  -> packages/interchange/persist/*
  -> app/interchange/share/runShare
  -> packages/interchange/extract/extractSubgraph
  -> app/interchange/materialize/runMaterialize
  -> destination app / website / portable package
```

## Phase definitions

Use these phase names consistently:

1. `ingest`
2. `persist`
3. `share`
4. `extract`
5. `materialize`
6. `serialize`

In practice:

- `ingest` means app-native data collection and normalization before DB writes
- `persist` means writing shared DB inputs
- `share` means granting access and resolving which resources are shareable
- `extract` means reading the shared graph shape back out of the DB as a `Subgraph`
- `materialize` means applying that `Subgraph` into an app
- `serialize` means turning that `Subgraph` into a transport artifact such as a portable package

## Naming conventions

Use the same top-level exported names in each app even when the implementations differ:

- `runIngest`
- `runShare`
- `runMaterialize`
- `buildContentInputs`
- `buildConceptInputs`
- `collectNodes`
- `collectSchemas`
- `collectRelations`
- `collectAssets`
- `applyNodes`
- `applySchemas`
- `applyRelations`
- `applyAssets`

That symmetry is more important than trying to make the internals identical.

## Current Obsidian mapping

The current Obsidian code already covers all three app-facing phases.

### Ingest

Current files:

- `syncDgNodesToSupabase.ts`
- `upsertNodesAsContentWithEmbeddings.ts`
- `conceptConversion.ts`
- `getDiscourseNodes.ts`
- `relationsStore.ts`

Suggested future mapping:

- `syncDgNodesToSupabase.ts` -> `interchange/ingest/runIngest.ts`
- `upsertNodesAsContentWithEmbeddings.ts` -> split between:
  - `interchange/ingest/buildContentInputs.ts`
  - shared `packages/interchange/persist/upsertContent.ts`
- `conceptConversion.ts` -> split between:
  - `interchange/ingest/buildConceptInputs.ts`
  - shared `packages/interchange/persist/upsertConcepts.ts`
- node and relation collection helpers -> `interchange/ingest/collect*.ts`

### Share

Current files:

- `publishNode.ts`
- parts of `registerCommands.ts`

Suggested future mapping:

- `publishNode.ts` -> split into:
  - `interchange/share/buildShareSelection.ts`
  - `interchange/share/shareNodes.ts`
  - `interchange/share/shareSchemas.ts`
  - `interchange/share/shareRelations.ts`
  - `interchange/share/shareAssets.ts`
  - `interchange/share/runShare.ts`

### Materialize

Current files:

- `importNodes.ts`
- `importRelations.ts`
- `importPreview.ts`

Suggested future mapping:

- `importPreview.ts` -> `interchange/materialize/previewSubgraph.ts`
- `importNodes.ts` -> split into:
  - `interchange/materialize/applyNodes.ts`
  - `interchange/materialize/applyAssets.ts`
  - `interchange/materialize/runMaterialize.ts`
- `importRelations.ts` -> `interchange/materialize/applyRelations.ts`

### Host boundary

Current files:

- `supabaseContext.ts`
- `rid.ts`
- `spaceFromRid.ts`
- parts of `relationsStore.ts`

Suggested future mapping:

- app and identity helpers -> `interchange/host/*`

## Current Roam mapping

The current Roam code strongly covers ingest, lightly covers materialization, and does not yet have a true share layer for this DB-backed interchange flow.

### Ingest

Current files:

- `syncDgNodesToSupabase.ts`
- `upsertNodesAsContentWithEmbeddings.ts`
- `conceptConversion.ts`
- `getAllDiscourseNodesSince.ts`

Suggested future mapping:

- `syncDgNodesToSupabase.ts` -> `interchange/ingest/runIngest.ts`
- `getAllDiscourseNodesSince.ts` -> `interchange/ingest/collectNodes.ts`
- `upsertNodesAsContentWithEmbeddings.ts` -> split between:
  - `interchange/ingest/buildContentInputs.ts`
  - shared `packages/interchange/persist/upsertContent.ts`
- `conceptConversion.ts` -> split between:
  - `interchange/ingest/buildConceptInputs.ts`
  - shared `packages/interchange/persist/upsertConcepts.ts`

### Share

Current state:

- no true Roam -> DB-backed share/import flow matching Obsidian
- no clear equivalent yet to `publishNode.ts`

Suggested future mapping:

- create the same folder and filenames under `interchange/share/`
- allow some files to start as thin stubs until the Roam sharing model is defined

### Materialize

Current files that are relevant seeds:

- `importDiscourseGraph.ts`
- `pageToMarkdown.ts`
- `getDiscourseContextResults.ts`
- `getExportTypes.ts`

Suggested future mapping:

- `importDiscourseGraph.ts` -> early seed for `interchange/materialize/runMaterialize.ts`
- `pageToMarkdown.ts` and `getDiscourseContextResults.ts` are useful reference logic, but they are not yet DB-to-Roam materializers
- a real `applyNodes.ts`, `applySchemas.ts`, `applyRelations.ts`, and `applyAssets.ts` still need to be created

### Host boundary

Current files:

- Roam datalog and block/page helpers
- `supabaseContext.ts`
- various page and block read/write helpers

Suggested future mapping:

- host-specific graph reads and writes -> `interchange/host/*`

## What this buys us

- a contributor can open either app and find the same interchange phases in the same places
- the app-specific code stays at the edges where it belongs
- the shared DB logic stops being duplicated across Roam and Obsidian
- future `Subgraph` extraction and portable package work has one clear home
- the current Obsidian path becomes the reference implementation without forcing Roam to match every detail immediately

## Notes

- The symmetry should be at the folder and exported-function level, not at the implementation-detail level.
- Roam should still get the same folder structure even if some files initially contain placeholders or thin wrappers.
- `persist`, `extract`, and `serialize` should not be duplicated inside each app just to preserve visual symmetry. Those belong in the shared package.
