# Concept design

This document aims to explain the rationale of the Concept table, and how it relates to DiscourseGraph data structures.

## DiscourseGraph structures

DiscourseGraph assumes a basic graph data model: All knowledge objects are Nodes (with literal properties and a text description) or Relations between Nodes (without attributes other than its source or destination.)

Both Nodes and Relations are typed, and thus we have Node schemas describing node types.
Relations schemas allow for constraints on source and destination node types.
The Roam implementation of relation schemas contains a specific pair of constraints, forming the triple: (source node type, relation label, destination node type).
Many triples with a common label are implicitly connected.

The Obsidian implementation made that connection explicit, and further defined a RelationType schema, with the label information, while the RelationTriple schema refers to the type constraint triple. Both this schema (with triple and type) and the roam-style schema that combines triple and type information are modeled with the RelationTripleSchema type.

## Generalization

When designing the database format, I (Marc-Antoine) thought that those five kinds (Node and Relation instances, Node schemas, RelationType schemas, RelationTriple schemas) were really special cases of a single underlying data object type, which I called Concept.

### Underlying rationale

Note: Implementors can skip this section.

This generalization is rooted in prior experience with RDF, TopicMaps, semantic Frames, and David Spivak's [algebraic database](https://arxiv.org/abs/1602.03501) representation. In all cases, any type is defined by the attributes it can have. RDF calls them properties, Minsky's frames uses the term slots, etc. RDF/OWL distinguishes literal attributes (`owl: DatatypeProperty`, stored in the `literal_content` column) from attributes which are references to other objects (`owl:ObjectProperty` stored in the `reference_content` column). We adopted the term roles for ObjectProperties from TopicMaps. Spivak's work gives this distinction a categorical grounding.

Unifying relations and nodes in particular allows relations to both have extra attributes (as in a PropertyGraph vs. a strict RDF graph) and be referred to (either as the source/destination of another Relation, or as a target of an `ObjectProperty`.) Cliff Joslyn described this recursive mathematical structure as a [übergraph](https://arxiv.org/abs/1704.05547v1). It can also be expressed as reified relations in RDF-\*.

### Use cases

Having ObjectProperties makes it possible to represent certain special cases of DiscourseGraphs, such as the necessary relation between Evidence and Source.

Having referenceable relations allows arguments to be made about relations.

However, it does mean that there is an underlying tension between what should be modeled as an ObjectProperty of a type vs a reified Relation. In general, ObjectProperties should be used whenever the relation is constitutive of the source object. This is akin to the composition vs aggregation distinction in UML.

### Mapping between CrossApp types and the database.

The five object kinds are not represented directly in the database, the mapping needs explaining. I will use the CrossApp types as a basis to make the distinction.

#### CrossApp type fields (taken from `src/crossAppContract.ts`)

```yaml
Base:
  localId: LocalId
  spaceUrl?: string ## OR Rid
  createdAt: Date
  modifiedAt?: Date
  authorId: LocalId

CrossAppNodeSchema:
  # Base and...
  metadata?: Json
  label: string
  template?: string
  templateTitle?: string

CrossAppRelationTypeSchema:
  # Base and...
  metadata?: Json
  label: string
  complement: string

CrossAppRelationTripleSchema (Roam):
  # Base and...
  metadata?: Json
  label: string
  complement: string
  sourceType: LocalId
  destinationType: LocalId

CrossAppRelationTripleSchema (Obsidian):
  # Base and...
  metadata?: Json
  relation: LocalId
  sourceType: LocalId
  destinationType: LocalId

CrossAppNode:
  # Base and...
  nodeType: LocalId
  content.direct: InlineCrossAppContent
  content.full?: InlineCrossAppTypedContent

CrossAppRelation:
  # Base and...
  relationType: LocalId # Refers to CrossAppRelationTripleSchema in Roam, CrossAppRelationTypeSchema in Obsidian
  source: LocalId | Rid
  destination: LocalId | Rid
```

#### Matching of common fields between CrossApp and Content

| CrossApp field | Content column                   |
| -------------- | -------------------------------- |
| -              | `id`                             |
| -              | `epistemic_status`               |
| -              | `description`                    |
| `localId`      | `source_local_id`                |
| `spaceUrl`     | ~`space_id`                      |
| `createdAt`    | `created`                        |
| `modifiedAt`   | `last_modified`                  |
| `authorId`     | `author_local_id` => `author_id` |
| `metadata`     | `literal_content`                |

Note: When fields below are mapped to keys of `literal_content`, those key-value pairs are not mapped back to `metadata`. Thus `metadata` is a grab-bag for residual data. (Eg color for now.)

Also, residual (not otherwise accounted for) keys in Obsidian frontmatter are mapped to `literal_content->source_data`.

#### Matching of CrossAppNodeSchema and Content (currently)

| CrossAppNodeSchema | Content                             | value |
| ------------------ | ----------------------------------- | ----- |
| `label`            | `name`, `literal_content->label`    | {}    |
| `template`         | `literal_content->template_content` |       |
| `templateTitle`    | `literal_content->template`         |       |
| -                  | `is_schema`                         | true  |
| -                  | `schema_id`                         | null  |
| -                  | `arity`                             | 0     |
| -                  | `reference_content`                 | {}    |

Note that this does not yet allow for ObjectProperties to be defined; this would require to define `literal_content->roles`, corresponding `reference_content`s, and change the `arity`. See below.

Query filter: `.eq("arity",0).eq("is_schema", true)`

#### Matching of CrossAppNode and Content

| CrossAppNode | Content                          | value              |
| ------------ | -------------------------------- | ------------------ |
| -            | `is_schema`                      | false              |
| -            | `arity`                          | 0                  |
| -            | `reference_content`              | {}                 |
| `nodeType`   | `schema_local_id` => `schema_id` | ref to Node schema |

Query filter: `.eq("arity",0).eq("is_schema", false)`

#### Matching of CrossAppRelationTypeSchema and Content (Obsidian only)

| CrossAppRelationTypeSchema | Content                          | value                       |
| -------------------------- | -------------------------------- | --------------------------- |
| -                          | `literal_content->roles`         | `["source", "destination"]` |
| -                          | `is_schema`                      | true                        |
| -                          | `schema_id`                      | null                        |
| -                          | `arity`                          | 2                           |
| -                          | `reference_content`              | {}                          |
| `label`                    | `name`, `literal_content->label` |                             |
| `complement`               | `literal_content->complement`    |                             |

Query filter: `.eq("arity",2).eq("is_schema", true).is("reference_content->source", "null")`

#### Matching of Obsidian CrossAppRelationTripleSchema and Content

| CrossAppRelationTripleSchema | Content                            | value                          |
| ---------------------------- | ---------------------------------- | ------------------------------ |
| -                            | `name`                             | composite                      |
| -                            | `literal_content->label`           | taken from RelationType schema |
| -                            | `literal_content->complement`      | taken from RelationType schema |
| -                            | `literal_content->roles`           | `["source", "destination"]`    |
| -                            | `is_schema`                        | true                           |
| -                            | `schema_id`                        | null                           |
| -                            | `arity`                            | 2                              |
| `sourceType`                 | `reference_content->source`        | ref to Node schema             |
| `destinationType`            | `reference_content->destination`   | ref to Node schema             |
| `relation`                   | `reference_content->relation_type` | ref to RelationType schema     |

Query filter: `.eq("arity",2).eq("is_schema", true).not("reference_content->relation_type", "is", "null")`

#### Matching of Roam CrossAppRelationTripleSchema and Content

| CrossAppRelationTripleSchema | Content                          | value                       |
| ---------------------------- | -------------------------------- | --------------------------- |
| -                            | `name`                           | composite                   |
| -                            | `literal_content->roles`         | `["source", "destination"]` |
| -                            | `is_schema`                      | true                        |
| -                            | `schema_id`                      | null                        |
| -                            | `arity`                          | 2                           |
| `label`                      | `literal_content->label`         |                             |
| `complement`                 | `literal_content->complement`    |                             |
| `sourceType`                 | `reference_content->source`      | ref to Node schema          |
| `destinationType`            | `reference_content->destination` | ref to Node schema          |

Note that putting the relationType in `reference_content->relation_type` without a corresponding role was a hackish shortcut, and should be revisited (see below.)

Query filter: `.eq("arity",2).eq("is_schema", true).not("reference_content->source", "is", "null").is("reference_content->relation_type", "null")`

In most cases, you would want both Roam and Obsidian RelationTripleSchemas, hence you would simply use:

Combined query filter: `.eq("arity",2).eq("is_schema", true).not("reference_content->source", "is", "null")`

#### Matching of Obsidian CrossAppRelation and Content

| CrossAppRelation | Content                          | value                        |
| ---------------- | -------------------------------- | ---------------------------- |
| -                | `name`                           | composite                    |
| -                | `is_schema`                      | false                        |
| -                | `arity`                          | 2                            |
| `relationType`   | `schema_id` (in Obsidian)        | ref to RelationType schema   |
| `relationType`   | `schema_id` (in Roam)            | ref to RelationTriple schema |
| `source`         | `reference_content->source`      | ref to Node                  |
| `destination`    | `reference_content->destination` | ref to Node                  |

Query filter: `.eq("arity",2).eq("is_schema", false)`

### Design considerations and future changes

#### Arity and ObjectProperties

The arity on either a schema or instance is based on the size of the `literal_content->role` array in the schema.
The `reference_content` allows either single or multiple values (`Record<string, number|number[]>`). The `reference_content` values are collated in a computed column `refs`, whose index allows for efficient filters on sql queries before digging into the `reference_content` jsonb.

As a first approximation, we distinguished relations from nodes using `arity==2`, but this precludes using ObjectProperties.

To remedy this, we propose adding a computed column `is_relation`, which would check whether (source, destination) are both in the schema's roles. The query filters using `arity` would be redefined to use `is_relation`.

Internal node references such as the Evidence's Source can then be expressed using roles and internal relations.

In RelationTripleInstance, we refer to the RelationTypeInstance with a `relation_type` entry in the `reference_content` column. This, unusually, is not backed by an entry in the `roles`. This is a deviation from the mental model, but in the current situation, adding that role would break the "arity=2" checks. Introducing the `is_relation` column will also allow this to be part of the roles. Note that we probably won't add a range constraint in that case; the constraint should require the relation_type to be any RelationTypeSchema, but there is no row materializing this meta-class.
