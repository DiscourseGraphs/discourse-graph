# G. Suggested next refactors

## 1. Write a short authoritative architecture note

Add a repo doc that explicitly defines:

- schema layer
- data layer
- transport layer
- the mapping rules between them

This should point directly to:

- `packages/database/supabase/schemas/*.sql`
- `apps/website/public/schema/*.ttl`
- client sync modules in Roam and Obsidian

## 2. Introduce an explicit shared assertion model

Decide whether to add:

- a real `Assertion` or `RelationInstance` table
- or at minimum a named SQL view/type that formalizes the current subset of `Concept` rows representing assertions

That would remove the current ambiguity where `Concept` is both the generic semantic container and the effective edge table.

## 3. Make concept-to-content linkage explicit

Replace the implicit join on `(space_id, source_local_id)` with an explicit model:

- `ConceptRepresentation`
- `ConceptContentLink`
- or a restored dedicated FK/join table

This is especially important because `Content` now supports multiple variants.

## 4. Normalize provenance and import/publication metadata

Decide what belongs in shared persistence for:

- imported origin
- published/shared state
- source quote/snippet provenance
- relation-instance provenance
- evidence attachment to claims/assertions

Then model those explicitly instead of pushing them into ad hoc JSON or leaving them local-only.

## 5. Align Roam relation sync with Obsidian relation sync

Pick one product-wide story for relations:

- stored/reified relation instances
- fully query-derived relations
- or both, but with a documented canonical precedence rule

Then make Roam sync project relation schemas and relation instances into Supabase with the same completeness that Obsidian already has.

## 6. Separate relation type from relation triple schema

If both notions are needed, make them distinct in the shared model:

- relation predicate definition
- typed relation pattern or admissibility rule

Right now both end up as `Concept` schema rows with different JSON shapes.

## 7. Retire stale legacy model artifacts

Clean up:

- `packages/database/schema.yaml` fields and classes that no longer match SQL
- `public."EntityType"` values that imply non-existent persisted constructs
- deprecated `represented_by_local_id` and similar composite input fields

That will reduce confusion between historical design intent and current implementation.

## 8. Decide what the shared canonical vocabulary is

Decide whether built-ins such as:

- `Question`
- `Claim`
- `Evidence`
- `Source`

should be authoritative in:

- TTL ontology files
- seeded DB data
- client defaults

Right now the answer is effectively "all of the above", which makes drift easy.

## 9. Add tests that pin the current data-layer contract

At minimum, add or extend tests for:

- relation-instance upsert and query behavior
- `reference_content` role binding resolution
- multi-variant content and `content_of_concept`
- RID resolution
- `ResourceAccess` behavior across concept/content/file sharing
- Roam and Obsidian parity for relation sync

## 10. Consider a formal mapping spec

The next durable step after the docs in this folder would be a mapping spec with four sections:

1. conceptual schema term
2. shared data-layer representation
3. client-local representation
4. transport/export representation

That would make future refactors measurable and would stop schema, data, and transport from collapsing into one another in docs and code reviews.
