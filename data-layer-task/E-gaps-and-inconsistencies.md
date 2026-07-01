# E. Gaps and inconsistencies

## 1. Relation as first-class object is only partially implemented

The conceptual story suggests a first-class relation/assertion model:

- `apps/website/public/schema/dg_base.ttl` defines `dgb:RelationInstance` as a subclass of `rdf:Statement`
- `packages/database/doc/concept_example.md` discusses occurrence structure and asks whether it should be materialized in another table

But the shared persisted implementation is still:

- `Concept` row
- `schema_id`
- `reference_content`
- generated `refs`

Missing from shared persistence:

- dedicated assertion table
- dedicated edge table
- dedicated occurrence table
- provenance/evidence table for a relation instance
- stable per-role metadata model

## 2. Concept-to-content linkage is implicit and currently ambiguous

`public.content_of_concept` in `packages/database/supabase/schemas/concept.sql` joins by:

- `space_id`
- `source_local_id`

It does **not** filter `Content.variant`, even though `Content` is unique on `(space_id, source_local_id, variant)`.

That creates a real ambiguity:

- one concept can correspond to multiple content variants such as `direct` and `full`
- the helper comments call this "one-to-one"
- the actual SQL can return multiple content rows

This is an implementation mismatch, not a conceptual schema choice.

## 3. Roam and Obsidian do not share the same effective local data model

Obsidian currently has a richer and more explicit local graph model:

- node type schemas
- relation type schemas
- triple schemas
- relation instances in `relations.json`

Roam still straddles two approaches:

- legacy query-derived relations
- newer stored reified relation blocks

And the shared sync behavior diverges:

- Obsidian sync pushes relation schemas and relation instances into Supabase
- Roam sync primarily pushes node schemas and node instances

So the product does not yet have a uniform cross-client data layer for relations.

## 4. Several legacy constructs still appear in design artifacts and composite inputs

### In `packages/database/schema.yaml`

The YAML model still exposes or implies constructs that are not cleanly present in the current live schema:

- `Person`
- `AutomatedAgent`
- `ConceptSchema`
- `ContentLink`
- `Occurrence`
- `SpaceAccess.editor` boolean instead of the current permissions enum

### In SQL composite inputs

`packages/database/supabase/schemas/concept.sql` still defines legacy fields in `public.concept_local_input`:

- `represented_by_id`
- `represented_by_local_id` marked deprecated

Those fields are implementation leftovers and should not be described as part of the clean current data layer.

## 5. DB-specific constraints are easy to over-elevate into schema

These are implementation constraints, not discourse-graph ontology:

- `Concept` unique on `(space_id, name)`
- `Content` unique on `(space_id, source_local_id, variant)`
- `ResourceAccess` keyed by `(account_uid, source_local_id, space_id)`
- `FileReference` forced to attach to the `full` content variant via a generated column

They are important for the implemented data layer, but they are not schema-layer truths about discourse graphs.

## 6. Provenance is under-modeled in shared persistence

The codebase talks about:

- provenance
- source attribution
- evidence linkage
- publication/import origin

But the shared model has only fragments of that:

- author and timestamps on `Concept`, `Content`, `Document`
- local `importedFromRid` fields in Obsidian
- ad hoc JSON inside `literal_content` or frontmatter
- transport-level `prov:generatedAtTime` in Roam JSON-LD export

There is no normalized shared representation for:

- source snippet or quote provenance
- evidence record attached to a claim/assertion
- publication/import provenance across spaces
- relation-instance provenance beyond author/time

## 7. Built-in discourse kinds are not normalized as shared vocabulary records

`Question`, `Claim`, `Evidence`, and `Source` exist in several places:

- ontology TTL files
- Obsidian defaults
- Roam config defaults

But they are not currently seeded or enforced as a single canonical shared vocabulary table. That means the same conceptual schema can exist as:

- ontology terms
- local plugin defaults
- synced `Concept` schema rows

without one clearly designated authoritative layer.

## 8. Transport fields leak into internal records

Examples:

- `importedFromRid` is stored in local plugin data and sometimes pushed into `literal_content`
- Roam JSON-LD export uses `@id`, `@type`, `rdf:predicate`, `prov:generatedAtTime`
- API payloads often mirror DB rows closely enough that table shape and wire shape blur together

These are not always wrong, but they make it easy to mistake transport conveniences for canonical internal structure.

## 9. Triple schema vs relation type is not cleanly separated in shared persistence

Obsidian sync writes both:

- relation type schemas
- relation triple schemas tying source type, destination type, and relation type together

Both end up as `Concept` schema rows. The shared model does not have a dedicated distinction for:

- "predicate definition" vs
- "allowed typed relation pattern"

That distinction exists in client logic but is only implicit in the synced `Concept` rows.

## 10. Some conceptual terms are still missing as clean data-layer concepts

I did not find dedicated first-class shared data-layer models for:

- experiments
- issues
- results
- occurrences
- evidence records as separate from ordinary node instances

If those matter to the product, they are currently either:

- only conceptual schema/documentation terms
- or only user-defined node schemas

not normalized internal model concepts.
