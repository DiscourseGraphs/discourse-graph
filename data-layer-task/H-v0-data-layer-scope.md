# H. V0 scope: data-layer definition and crosswalk

## Goal + non-goals

### Goal

Define the current Discourse Graph data layer in a way that is precise enough to support v0 implementation and future portable-package work without requiring another round of reverse-engineering.

The output of this task is an authoritative repo doc that:

- defines what counts as the schema layer, data layer, and transport layer in the current repo
- names the current source-of-truth artifacts for each layer
- documents a one-to-one crosswalk from schema concepts to data-layer representations to portable-package or transport representations
- calls out where the mapping is exact, where it is lossy, and where the implementation is only partially aligned with the conceptual schema

For this task, "one-to-one documentation" means every important schema concept should map to a documented data-layer representation and a documented portable-package or transport representation, even when those representations are not structurally identical.

### Non-goals

- redesign the data model
- introduce new DB tables such as `Assertion`, `Occurrence`, or `ConceptContentLink`
- unify Roam and Obsidian relation behavior in code
- change sync logic, API payloads, or SQL schema as part of this task
- fully resolve all historical inconsistencies in `schema.yaml`, old migrations, or legacy composite fields
- define the final portable package in detail beyond the minimum mapping contract needed for v0

## v0 scope

This v0 should stay intentionally small. The data layer mostly already exists and works. The missing work is not major implementation; it is definition, documentation, and boundary-setting.

v0 includes:

- a short authoritative definition of the current data layer as implemented now
- a clear separation between conceptual schema, persisted data model, and transport or portable representations
- a mapping table for the core concepts that matter to the portable package
- explicit treatment of relation instances, which are the highest-risk source of confusion
- explicit documentation of current divergences between shared Supabase persistence and client-local Roam or Obsidian representations
- a minimal contract for what the portable package must preserve when built from the data layer

v0 does not need:

- a perfect end-state architecture
- complete ontology cleanup
- full cross-client parity
- a new persistence abstraction layer

## In-scope use cases

- `UC-1`: An engineer can answer "what is the current data layer?" from one short doc without reading SQL, TTL, and client sync code separately.
- `UC-2`: An engineer can answer "how is `Claim`, `Evidence`, `Question`, or `Source` represented in the schema layer, the data layer, and the transport layer?"
- `UC-3`: An engineer can answer "how is a relation instance represented today?" and see the current answer across schema, Supabase, Roam, and Obsidian.
- `UC-4`: An engineer can point from a schema term such as `dgb:NodeSchema` or `dgb:RelationInstance` to the concrete current data-layer representation.
- `UC-5`: An engineer can point from a current data-layer record such as `Concept`, `Content`, or `Document` to the portable-package representation that should be derived from it.
- `UC-6`: An engineer can identify where the mapping is clean and where there are known caveats such as triple-schema leakage, multi-variant content, or transport metadata leaking into local state.
- `UC-7`: An engineer can start the portable-package task without first deciding whether the schema, SQL model, or API payloads are the canonical truth.

## Out of scope

- implementation of the portable package itself
- creation of a new shared runtime model beyond the documented v0 mapping contract
- DB migrations or schema refactors
- content-model redesign
- provenance-model redesign
- relation-model redesign
- changing website API contracts
- rewriting Roam or Obsidian sync code
- seeding or enforcing a canonical vocabulary in persistence

## Constraints/assumptions

- The current shared data model is centered on `Concept`, `Content`, and `Document`, plus access, identity, file, embedding, and sync records.
- The conceptual schema is primarily defined by `apps/website/public/schema/dg_base.ttl` and `apps/website/public/schema/dg_core.ttl`.
- `packages/database/schema.yaml` is useful as historical design context but should not be treated as the authoritative implementation model where it conflicts with current SQL.
- Client-local persistence in Roam and Obsidian is part of the current data layer because it is upstream of the shared Supabase representation.
- The transport layer includes API payloads, RID helpers, JSON-LD export, and future portable-package representations.
- v0 should be optimized for speed and clarity, not completeness. A repo-faithful explanation is more important than a more elegant but aspirational model.
- This should fit within roughly one to two engineer days.

## Milestones

### Milestone 1: define the current data layer

**Deliverable**

- One short architecture note that defines the schema layer, data layer, and transport layer and names the current source-of-truth artifacts for each.

**Acceptance criteria**

- The doc clearly states that the current shared persisted semantic center is `Concept`, with `Content` and `Document` as representation records.
- The doc distinguishes conceptual schema files from SQL persistence from API or export representations.
- The doc explicitly marks stale or partially stale artifacts such as `schema.yaml` as non-authoritative where applicable.

**Dependencies**

- Existing reverse-engineering docs in `data-layer-task`

**Estimate**

- `0.25-0.5` day

### Milestone 2: publish the schema-to-data crosswalk

**Deliverable**

- A core crosswalk table covering the main concepts needed for v0: node schema, relation schema, node instance, relation instance, content, document, access, file assets, and RID or transport identity.

**Acceptance criteria**

- Each row identifies the schema-layer concept, the current shared data-layer representation, the current client-local representation where relevant, and the current transport or portable representation.
- The crosswalk explicitly documents the current relation-instance mapping as `Concept` plus `schema_id` plus `reference_content`.
- The crosswalk explicitly documents the current concept-to-content linkage caveat and any places where the mapping is not truly one-to-one in storage even if it is one-to-one in documentation.

**Dependencies**

- Milestone 1

**Estimate**

- `0.5-1` day

### Milestone 3: define the portable-package handoff contract

**Deliverable**

- A v0 contract for what the portable package must preserve from the data layer, plus a short list of known gaps that are deferred.

**Acceptance criteria**

- The contract names the minimum portable concepts that must survive translation out of the data layer.
- The contract separates required preserved semantics from deferred improvements.
- The contract is sufficient for an engineer to start the portable-package task without re-opening the question of what the current data layer is.

**Dependencies**

- Milestone 2

**Estimate**

- `0.25-0.5` day

## Requirements

### Functional requirements

These should be treated as the v0 backlog. Ideally each requirement becomes one Linear issue.

#### P0

- `FR-1`: Produce one authoritative doc that defines the current schema layer, data layer, and transport layer for this repo.
- `FR-2`: Identify the authoritative source files for each layer and explicitly mark historical or stale artifacts that should not be treated as canonical implementation truth.
- `FR-3`: Define the current shared data layer in repo-faithful terms, centered on `Concept`, `Content`, and `Document`.
- `FR-4`: Document how node schemas, relation schemas, node instances, and relation instances are represented in the current data layer.
- `FR-5`: Document how the built-in vocabulary terms `Question`, `Claim`, `Evidence`, and `Source` appear across schema, local client defaults, and shared persistence.
- `FR-6`: Document how relation instances map from schema semantics to shared persistence to local Roam and Obsidian storage.
- `FR-7`: Document the minimum mapping from the data layer to the portable package, including what fields and semantics must be preserved.

#### P1

- `FR-8`: Document the concept-to-content representation story, including the current multi-variant ambiguity and the practical implication for portable-package design.
- `FR-9`: Document the current distinction between relation type schemas and typed relation or triple schemas, including where that distinction collapses in shared persistence.
- `FR-10`: Document which transport concepts such as RID, JSON-LD fields, and API payload shapes are downstream projections rather than canonical internal structures.
- `FR-11`: Capture current Roam and Obsidian divergence where it materially affects the data-layer story, especially around relation sync completeness.

#### P2

- `FR-12`: Add a short recommended follow-on list for post-v0 work, without making those follow-ons blockers for the current scope.

## Open questions + risks

### Open questions

- Should the portable package be defined purely from the shared Supabase model, or should it intentionally preserve some client-local distinctions that only exist in Roam or Obsidian today?
- Should `schema.yaml` appear in the final crosswalk as a historical design artifact, or should it be excluded from the main definition and mentioned only as context?
- How much of the Obsidian triple-schema model should be represented in the portable package if the shared persisted model does not distinguish it cleanly?
- Is the intended portable-package source primarily the shared data layer, or a normalized view over schema plus data layer together?
- Do we want the v0 doc to define one canonical precedence rule when schema, SQL, and transport artifacts disagree?

### Risks

- The biggest risk is accidental scope creep into redesign work such as new assertion tables, provenance normalization, or sync refactors.
- The current implementation does not provide a clean one-structure-per-concept mapping, especially for relation instances, so the documentation must be careful not to overstate structural alignment.
- Roam and Obsidian currently diverge enough that a single "current data layer" story can become misleading unless client-local differences are called out explicitly.
- The concept-to-content link is only implicit today, which creates risk for any downstream portable-package contract that assumes a strict one-to-one representation record.
- If this doc overfits to current storage details, it may become stale quickly once the portable package or relation model evolves. The v0 wording should therefore distinguish "implemented now" from "recommended future direction."
