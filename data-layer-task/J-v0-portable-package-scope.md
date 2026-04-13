# J. V0 scope: portable package

## Summary

This doc scopes the first Discourse Graph portable package as a transport contract that sits downstream of the internal data layer defined in `ENG-1636`.

The v0 portable package should be:

- a normalized projection over the internal data layer, not a copy of DB tables or current API payloads
- shared across Obsidian, Roam, and the website
- scoped around one root node plus one-hop closure (TBD)
- required to carry `ATJSON` content under `content`
- required to include referenced assets (TBD)

The immediate goal is one package contract that supports:

- Obsidian to Obsidian
- Obsidian to Roam
- Roam to Roam
- website display in Next.js

The same contract should also be reusable later for an API that returns the portable package for a specific node.

## Problem

- We now have a clearer definition of the internal data layer, but we still do not have one portable package contract that all sharing flows use.
- Obsidian-to-Obsidian sharing is currently handled by bespoke share/import logic over shared persistence, especially `my_contents`, relation queries, and `FileReference` asset import.
- Roam and website sharing do not currently use the same transport pattern.
- This makes cross-app transport inconsistent and leaves no single package shape that a future sharing API can expose.
- Content is also moving toward `ATJSON`, but current transport behavior is still tied to app-native or ad hoc representations.

## Solution

- Define a v0 portable package as a shared app-agnostic transport contract derived from the internal data layer.
- Scope the package around a single root node bundle.
- The bundle includes:
  - the root node instance
  - required node schemas and relation schemas
  - directly connected relation instances
  - counterpart nodes needed to keep those direct relations usable
  - `ATJSON` content payloads under `content`
  - document or source metadata needed to preserve origin
  - stable source identity such as RID or equivalent source space plus local ID
  - referenced file assets and asset metadata
- Keep HTML out of the required package payload. Website rendering should derive HTML downstream from `ATJSON`.
- Allow opaque app-specific fidelity metadata only where needed to avoid data loss, but do not make app-local storage quirks the primary public contract.
- Require the same producer or consumer pattern for Obsidian, Roam, and website use cases so the current bespoke Obsidian path can later migrate onto the same contract.

## Done when

- There is one agreed v0 package contract that traces cleanly back to the internal data layer defined in `ENG-1636`.
- The contract explicitly carries:
  - root node identity
  - included node instances and relation instances
  - required node and relation schemas
  - `ATJSON` content payloads under `content`
  - document or source metadata
  - stable source identity
  - referenced file assets and asset metadata
- The bundle boundary is explicit: one root node plus one-hop closure (TBD), not root-only and not full recursive graph export.
- The contract is stated as the common transport shape for the four immediate v0 use cases.
- The contract is also clear enough that a future API can return the same package for one requested node without redefining the shape.

## Out of scope

- implementing the portable package
- locking the final archive or container format such as zip versus directory
- embedding HTML in the package payload
- access control, group membership, `ResourceAccess`, sync state, embeddings, or sharing workflow metadata as package requirements
- redesigning the internal data model or adding new assertion, occurrence, or concept-content-link tables
- fixing the current concept-to-content storage model
- full recursive subgraph export
- richer provenance or evidence modeling beyond what the current data layer already exposes

## Notes

- Use `content`, not `narrative`.
- `ATJSON` is the required content representation for v0.
- HTML may still be produced by downstream consumers, especially the website, but it is not a required package payload in v0.
- Assets are included in v0 because the current Obsidian import path already depends on file transfer and the website will need the same behavior for evidence and media display.
- Preserve relation semantics without making Obsidian triple-schema leakage the public package abstraction. If admissibility rules need to survive, carry them as schema metadata rather than as the top-level transport concept.
- Roam may initially have less complete body-content coverage than Obsidian. The package contract should still be shared, with completeness limited only by what the upstream `ATJSON` layer can currently produce.

## Validation scenarios

- Obsidian to Obsidian: export a node with body content, a directly connected relation, and assets; import it through the v0 package path and confirm round-trip behavior.
- Obsidian to Roam: import the same bundle and confirm the root node, counterpart node, and direct relation remain usable.
- Roam to Roam: export and import through the same contract and confirm the package path works even if content coverage is initially partial.
- website: consume the package and render from `ATJSON` without relying on HTML embedded in the package.
- future API fit: confirm the bundle shape can be returned for one requested node without adding new required fields.

## Assumptions and defaults

- `ENG-1636` remains the upstream definition of schema, data-layer, and transport-layer precedence.
- The portable package is a normalized projection over the internal data layer.
- The v0 unit is one root node bundle with one-hop closure.
- The required content representation is `ATJSON` only.
- Referenced assets are included in the package.
