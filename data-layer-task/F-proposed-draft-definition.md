# F. Proposed draft definition of the data layer

## As implemented now

The current Discourse Graph data layer is a two-tier internal model:

- each client has its own local persistence model
- a shared Supabase model normalizes synced records across clients

The shared Supabase layer is centered on three core record families:

1. `Concept`
   - semantic records for node schemas, relation schemas, node instances, and relation instances
2. `Content` and `Document`
   - textual and document-level representations of those semantic records
3. operational/context records
   - `Space`, `PlatformAccount`, access tables, files, embeddings, sync state

In the current implementation, relation instances are not stored in a dedicated edge/assertion table. They are stored as `Concept` rows whose relation type is indicated by `schema_id` and whose participants are stored in `reference_content`.

## Idealized but still faithful to the repo

The most faithful concise definition is:

> The current data layer is the set of persisted records and local stores that instantiate discourse schema concepts in the product. In shared persistence, `Concept` is the canonical semantic record, `Content` is the canonical textual representation record, and `Document` is the canonical source-container record. Node types, relation types, node instances, and relation instances are all instantiated through `Concept`; relation participation is encoded through schema-linked role bindings in `reference_content`. Space/account/access/file/embedding/sync tables provide the surrounding operational context. Client-local Roam and Obsidian stores are upstream internal representations that sync into this shared model.

## Explicit model components

### Semantic records

- `Concept` schema rows
  - node schemas
  - relation schemas
  - client-specific triple schemas in some cases
- `Concept` instance rows
  - node instances
  - relation instances

### Representation records

- `Document`
  - source note/page/document container
- `Content`
  - one or more textual variants of a local resource
- `FileReference`
  - file/asset attachments associated with a resource

### Identity and ownership records

- `Space`
- `PlatformAccount`
- `AgentIdentifier`
- `LocalAccess`
- `SpaceAccess`
- `ResourceAccess`

### Derived and operational records

- embeddings
- contributor joins
- sync tasks
- access-filtered views

## Gap between current and intended state

The likely intended direction is richer than the current implementation.

### Current state

- relation instance is a generic `Concept`
- provenance is mostly author/time plus ad hoc JSON
- concept-to-content linkage is implicit by shared local ID
- transport concepts and local client state leak into shared semantics

### Intended state implied by the repo

- relation instance should behave more like a true first-class assertion object
- provenance and evidence linkage should be modeled explicitly
- representation linkage should be explicit rather than inferred
- schema vocabulary, data persistence, and transport projections should be more sharply separated

## Working definition to use in documentation now

Use this wording unless and until the model is refactored:

> The current data layer consists of the client-local Roam and Obsidian persistence models plus the shared Supabase persistence model they sync into. The shared model is centered on `Concept`, `Content`, and `Document`. `Concept` stores both schemas and instances, including relation instances; `Content` stores one or more textual variants keyed by local resource identity; `Document` stores source-document context. Access control, files, embeddings, and sync metadata live in supporting tables. JSON-LD, Turtle, API payloads, and RID strings are transport-layer projections over this internal state rather than the canonical data model itself.
