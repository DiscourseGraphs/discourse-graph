# J. V0 portable-package handoff contract

## Purpose

This note is the milestone-three deliverable from [H. V0 scope: data-layer definition and crosswalk](./H-v0-data-layer-scope.md).

Its job is to define the minimum v0 contract for what must survive translation out of the current data layer into a portable package.

This is not the implementation plan for the package itself. It is the handoff contract an engineer should be able to use to start package work without re-opening the data-layer definition.

## Short answer

The v0 portable package should be defined as a serialization of a `Subgraph`.

That means:

- the package is downstream of the internal database model
- the package is not the primary runtime abstraction for the current internal app-sharing flows
- the package should carry the same normalized extracted graph shape that app consumers would otherwise materialize directly

In other words:

```text
source app
  -> ingest
  -> persist
  -> share
  -> extractSubgraph(...)
  -> Subgraph
  -> toObsidian / toRoam / toWebsite / toPortablePackage
```

## Problem

- The current repo now has a clearer definition of schema layer, data layer, and transport layer, but the portable-package work still needs a concrete handoff contract.
- The current Obsidian sharing flow works through DB-backed sharing and import, not through a portable package.
- Roam and website flows are not yet aligned on one transport shape.
- Without a handoff contract, package work risks re-deciding:
  - which concepts are canonical
  - how relation instances are represented
  - whether content, document, and asset records are required
  - whether access and sharing state belong in the package

## Architectural position

For the immediate internal use cases, the database remains the interchange hub.

The current sharing model is selection-driven:

- a user chooses nodes to share
- the system shares those nodes
- relations are shared only when both endpoints are in the included node set
- schemas and assets are shared as needed for the included resources

That means the portable package should not define the inclusion rules for app sharing.

Instead:

- sharing decides what resource set should be available
- extraction turns that resource set into a normalized `Subgraph`
- the portable package serializes that `Subgraph`

The portable package is therefore a transport artifact, not the core runtime sharing abstraction.

## V0 package input

The input to `toPortablePackage(...)` should be a `Subgraph`.

A v0 `Subgraph` should be able to contain:

- one or more included node instances
- included relation instances
- required node schemas
- required relation schemas
- canonical content for included nodes
- source or document metadata where needed
- referenced file assets
- stable transport identity

The v0 package does not need to care whether that `Subgraph` was derived from:

- an explicit shared node set
- a one-node API request
- a future context-expansion request

That extraction choice happens upstream.

## Minimum portable concepts that must survive

These are the concepts milestone three should lock as required.

### Required payload concepts

- node instances
- relation instances
- node schemas
- relation schemas
- canonical content
- source or document metadata where needed to preserve origin
- file assets and asset metadata
- stable transport identity

### Required preserved semantics

- node type identity must survive translation out of `Concept`
- relation type identity must survive translation out of `Concept`
- relation endpoint bindings must survive translation out of `reference_content`
- content must survive in one canonical portable representation rather than the current multi-variant storage story
- enough source metadata must survive to preserve provenance and origin context needed by importers and renderers
- asset references must survive in a way that allows the destination to restore embeds or attachments
- cross-space identity must survive in a stable form such as RID or an equivalent source-space plus local-ID pair

## Required exclusions

These should be explicitly out of the v0 portable-package requirement even if they exist in the current data layer.

- `SpaceAccess`, `ResourceAccess`, and group membership state
- local share bookkeeping such as `publishedToGroups`
- sync bookkeeping
- embeddings
- DB-native numeric IDs
- HTML as a required payload format
- app-specific storage quirks as first-class top-level concepts

Those things may still exist in the runtime system. They are just not part of the minimum portable-package contract.

## Current-model caveats the contract must absorb

The package contract has to normalize several current implementation issues rather than exposing them directly.

### Relation-instance caveat

The current shared data model does not have a dedicated edge or assertion table.

A relation instance is currently represented as:

- one `Concept` row
- `schema_id` pointing to the relation schema
- `reference_content` holding role bindings

The package must preserve that meaning, but it should not expose the current DB encoding as the public abstraction.

### Concept-to-content caveat

The current shared model links concepts to content only indirectly through source identity and helpers such as `content_of_concept`.

A single concept can correspond to multiple content variants such as:

- `direct`
- `full`
- `direct_and_description`

The package contract should therefore require one canonical portable `content` representation, not a raw dump of current content variants.

### Client-divergence caveat

Obsidian and Roam do not currently have symmetric client-local representations, especially for relations and body-content completeness.

The package should preserve shared semantics, but it should not require every destination to materialize them with identical local storage structures.

## Recommended v0 shape

At the logical level, the package should contain:

- `nodes`
- `relations`
- `nodeTypes`
- `relationTypes`
- `content`
- `assets`
- `sourceMetadata`
- `identity`

For the actual artifact format, the likely direction is:

- manifest JSON
- binary asset payloads alongside it
- optional archive wrapper such as zip

But the archive or container choice is not part of milestone three.

## Immediate use cases vs future use cases

### Immediate internal use cases

These should continue to be thought of as DB-centered flows:

- Obsidian -> DB -> Obsidian
- Obsidian -> DB -> Roam
- Roam -> DB -> Roam
- app -> DB -> website

The package is not required to be the primary runtime path for those flows in v0.

### Future-facing use cases

These are where the package is more likely to be a first-class output:

- API returns a portable package for a requested node or node set
- external app interoperability
- file-based export or transfer

The contract should support those future use cases without forcing the internal app flows to route through the package immediately.

## Deferred improvements

These are explicitly not blockers for milestone three.

- locking the final package archive format
- full recursive subgraph export
- richer provenance objects
- explicit assertion or edge tables
- explicit concept-content link tables
- full Roam parity for relations and body content
- HTML as an alternate package content format
- evidence-bundle-specific packaging rules

## Done when

- the portable package is explicitly defined as a serialization of a `Subgraph`
- the minimum portable concepts are named clearly enough for implementation
- required preserved semantics are separated from excluded runtime-only data
- the current relation-instance and concept-to-content caveats are called out explicitly
- an engineer can start `toPortablePackage(subgraph)` work without reopening what the current data layer means

## Validation questions

An engineer reading this note should be able to answer:

- What must survive from the current data layer into the package?
- What current DB details should be normalized rather than exposed directly?
- What current runtime data is intentionally excluded from the package?
- How does the package relate to the new `Subgraph` abstraction?
- Why is the package downstream of sharing and extraction rather than the center of the current internal app-sharing flow?
