# M. Subgraph terminology decision

## Summary

This note records the naming decision for the shared extracted unit that sits between the internal database model and each downstream consumer.

Use `Subgraph` as the canonical term for the v0 shared abstraction.

This replaces earlier placeholder terms such as `NodeBundle` and `DiscourseContextSlice`.

The important clarification is that `Subgraph` is **not** the same thing as the user's share selection. Sharing is selection-driven. The subgraph is the extracted result after the system resolves which related resources are needed for a given use case.

## Why this term

- It matches the actual shape better once extraction is driven by a list of node IDs.
- It avoids collision with the planned `EvidenceBundle` node type.
- It keeps `package` reserved for the transport artifact rather than the in-memory shared abstraction.
- It is broad enough to cover both:
  - shared node-set extraction
  - future one-hop or deeper context expansion

## Existing repo language

The repo already uses `discourse context` in several places:

- `getDiscourseContext` in `packages/database/src/lib/queries.ts`
- `getDiscourseContextResults` in `apps/roam/src/utils/getDiscourseContextResults.ts`
- `ExportDiscourseContext` in `apps/roam/src/components/ExportDiscourseContext.tsx`
- `VIEW_TYPE_DISCOURSE_CONTEXT` in `apps/obsidian/src/types.ts`

By contrast, the current Obsidian import flow mostly uses operational names such as:

- `getPublishedNodesForGroups`
- `importSelectedNodes`
- `computeImportPreview`
- `fetchRelationInstancesFromSpace`

There is not already a clean Obsidian-side noun for "the extracted shared data needed for one operation." `Subgraph` is a better fit once the extraction input can be a list of node IDs.

## Intended meaning

`Subgraph` means the bounded extracted graph used for one sharing, import, rendering, or packaging operation.

It should be understood as a **derived subgraph**, not as the thing the user directly selects.

In the current sharing model, the user selects nodes to share. The system then derives the resources that should travel with that shared set.

In v0, a `Subgraph` should be able to contain:

- one or more seed nodes
- required relation instances
- required node schemas and relation schemas
- canonical content
- referenced assets
- source metadata needed to preserve identity and provenance

For the current Obsidian sharing behavior, the default rule is:

- include the explicitly selected or shared nodes
- include relations only when both endpoints are in the included node set
- include the schemas and assets needed by those included resources

This is a runtime or domain abstraction, not the transport artifact itself.

## Architectural position

The conceptual flow for the current share and import model is:

```text
source app
  -> app-specific ingest adapter
  -> internal database model
  -> share selection
  -> shared resource closure
  -> shared extraction pipeline
  -> Subgraph
  -> target-specific materializer OR portable-package serializer
  -> destination app / website / API response
```

That means:

- the database remains the interchange hub for the immediate internal use cases
- sharing is driven by an explicit node set, not by automatic one-hop expansion
- Obsidian, Roam, and website flows can consume the same extracted unit directly
- the portable package is a downstream serialization of a `Subgraph`

## Simple flow chart

The current share and import behavior is best described like this:

```text
user selects nodes to share
  -> sync selected nodes to DB
  -> share selected nodes to group
  -> auto-share schemas and assets for those nodes
  -> auto-share relations only when both endpoints are shared

recipient sees shared nodes
  -> chooses nodes to import
  -> extract Subgraph for the chosen node set
  -> materialize into Obsidian / Roam / website / portable package
```

The future shared abstraction should support at least two extraction modes:

```text
Mode 1: shared-set mode
  seed nodes = explicit selected or shared nodes
  relation policy = only relations between included nodes

Mode 2: context-expansion mode
  seed nodes = one requested root node
  expansion = one-hop or deeper
  relation policy = relations for all included nodes
```

## Obsidian-to-Obsidian code-backed example

The current Obsidian implementation does not yet have an explicit
`extractSubgraph(...)` function.

Instead, the behavior is split across share, discovery, preview, content import,
asset import, and relation import functions.

### Current share flow in code

```text
user runs Share command on active note
  -> registerCommands.ts -> publishNode(...)
  -> publishNodeToGroup(...)
  -> publishNodeRelations(...)
  -> publishSchema(...)
  -> addFile(...) for binary assets
  -> frontmatter.publishedToGroups updated locally
```

Concrete code points:

- The share command entrypoint is in `registerCommands.ts`.
- `publishNode(...)` is called from the command handler.
- `publishNodeToGroup(...)` is the main share implementation in the current code.
- `publishNodeRelations(...)` auto-shares relation resources only when both endpoints are shared to the same group.
- `publishSchema(...)` shares the node schema through `ResourceAccess`.
- `addFile(...)` uploads non-text assets and creates the related file records.

Important current limitation:

- sharing does **not** auto-sync an unsynced node first
- the command currently shows `Please sync the node first`
- `registerCommands.ts` contains a TODO comment for "Maybe sync the node now if unsynced"

### Current recipient-side import flow in code

```text
recipient opens import UI
  -> getAvailableGroupIds(...)
  -> getPublishedNodesForGroups(...)
  -> user selects nodes
  -> computeImportPreview(...)
  -> importSelectedNodes(...)
  -> fetchNodeContentForImport(...)
  -> processFileContent(...)
  -> importAssetsForNode(...)
  -> importRelationsForImportedNodes(...)
```

Concrete code points:

- `ImportNodesModal.tsx` loads importable nodes with:
  - `getAvailableGroupIds(...)`
  - `getPublishedNodesForGroups(...)`
- `computeImportPreview(...)` precomputes relation and schema implications for the selected nodes.
- `importSelectedNodes(...)` is the main content import orchestrator.
- `fetchNodeContentForImport(...)` fetches `direct` and `full` content variants from `my_contents`.
- `processFileContent(...)` creates or updates the local markdown file and frontmatter.
- `importAssetsForNode(...)` pulls file references and writes imported assets locally.
- `importRelationsForImportedNodes(...)` imports relation instances only when both endpoints resolve in the destination vault.

### Current relation rule in code

The current rule is set-driven, not one-hop-expansion-driven.

```text
if node A and node B are both shared
  and A -> B relation exists
then share the relation resources

if only node A is shared
then do not share A -> B relation resources
```

This rule is implemented by:

- `publishNodeRelations(...)`
- `publishNewRelation(...)`
- `ensurePublishedRelationsAccuracy(...)`

### What does not yet exist

These are the parts implied by the future architecture but not yet present as a
single shared layer:

- no explicit `Subgraph` type in code
- no `extractSubgraph(...)` DB extraction function
- no shared extraction layer that returns one normalized object for all consumers
- no `toPortablePackage(subgraph)` serializer
- no `toRoam(subgraph)` materializer
- no `toWebsite(subgraph)` materializer

### How the future flow should map from the current code

The future architecture should preserve the same current behavior, but move the
DB-query-heavy import logic behind one shared extraction step.

```text
user selects nodes to share
  -> current share flow stays app-specific
  -> DB records + group access are created

recipient selects shared nodes to import
  -> future extractSubgraph(seedNodeIds, relationPolicy="between-included-nodes")
  -> toObsidian(subgraph)
```

That means the current Obsidian import path is the strongest example of what
the future extraction layer must preserve, but the shared abstraction itself
does not yet exist as a first-class implementation.

## Naming conventions

Use these names in future design and implementation work:

- `extractSubgraph(...)`
- `type Subgraph = { ... }`
- `toObsidian(subgraph)`
- `toRoam(subgraph)`
- `toWebsite(subgraph)`
- `toPortablePackage(subgraph)`

Use `subgraph` as the short local variable name in code, but keep the full type and public function names explicit.

The extraction entry point should eventually accept inclusion rules rather than assuming a single-root context walk. For example:

- `seedNodeIds`
- `expansion`
- `relationPolicy`
- `includeSchemas`
- `includeAssets`
- `includeContent`

## Notes

- Avoid `bundle` in shared abstraction names.
- Avoid `package` for the in-memory object; keep that term for the serialized artifact.
- Do not treat `Subgraph` as a synonym for "shared node set." The shared node set is an input to extraction, not the extracted result.
