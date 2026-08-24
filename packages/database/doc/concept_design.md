# Concept design

This document aims to explain the rationale of the Concept table, and how it relates to Discourse Graph data structures.

## Discourse Graph structures

Discourse Graph assumes a basic graph data model: All knowledge objects are Nodes (with literal properties and a text description) or Relations between Nodes (without attributes other than its source or destination.)

Both Nodes and Relations are typed, and thus we have Node schemas describing node types.
Relations schemas allow for constraints on source and destination node types.
The [Roam Research implementation](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/roam) of relation schemas contains a specific pair of constraints, forming the triple: (source node type, relation label, destination node type).
Many triples with a common label are implicitly connected.

The [Obsidian implementation](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/obsidian) made that connection explicit, and further defined a RelationType schema, with the label information, while the RelationTriple schema refers to the type constraint triple. Both this schema (with triple and type) and the roam-style schema that combines triple and type information are modeled with the RelationTripleSchema type.

## Generalization

When designing the database format, I (Marc-Antoine) thought that those five kinds (Node and Relation instances, Node schemas, RelationType schemas, RelationTriple schemas) were really special cases of a single underlying data object type, which I called Concept.

### Underlying rationale

Note: Implementors can skip this section.

This generalization is rooted in prior experience with RDF, TopicMaps, semantic Frames, and David Spivak's [algebraic database](https://arxiv.org/abs/1602.03501) representation. In all cases, any type is defined by the attributes it can have. RDF calls them properties, Minsky's frames uses the term slots, etc. RDF/OWL distinguishes literal attributes (`owl: DatatypeProperty`, stored in the `literal_content` column) from attributes which are references to other objects (`owl:ObjectProperty` stored in the `reference_content` column). We adopted the term roles for ObjectProperties from TopicMaps. Spivak's work gives this distinction a categorical grounding.

Unifying relations and nodes in particular allows non-intrinsic relations to both have extra attributes (as in a PropertyGraph vs. a strict RDF graph) and be referred to (either as the source/destination of another Relation, or as a target of an `ObjectProperty`.) Cliff Joslyn described this recursive mathematical structure as a [übergraph](https://arxiv.org/abs/1704.05547v1). It can also be expressed as reified relations in RDF-\*.

### Use cases

Having ObjectProperties makes it possible to represent certain special cases of Discourse Graph, such as the necessary relation between Evidence and Source.

Having referenceable relations allows arguments to be made about relations.

However, it does mean that there is an underlying tension between what should be modeled as an ObjectProperty of a type vs a reified Relation. In general, ObjectProperties should be used whenever the relation is constitutive of the source object. This is akin to the composition vs aggregation distinction in UML.

### Mapping between CrossApp types and the database.

The five object kinds are not represented directly in the database, the mapping needs explaining. I will use the CrossApp types as a basis to make the distinction.

#### CrossApp type fields (taken from `src/crossAppContract.ts`)

```yaml
Base:
  localId: LocalId
  rid?: string
  createdAt: Date
  modifiedAt?: Date
  authorId: LocalId

CrossAppNodeSchema:
  # Base and...
  slotDefinitions: Record<string, LocalId> # Forthcoming
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
  slots: Record<string, LocalId> # Forthcoming

CrossAppRelation:
  # Base and...
  relationType: LocalId # Refers to CrossAppRelationTripleSchema in Roam, CrossAppRelationTypeSchema in Obsidian
  source: LocalId | Rid
  destination: LocalId | Rid
```

#### Matching of common fields between CrossApp and Concept

| CrossApp field |     | Concept column                   |
| -------------- | --- | -------------------------------- |
| -              |     | `id`                             |
| -              |     | `epistemic_status`               |
| -              |     | `description`                    |
| `localId`      | <-> | `source_local_id`                |
| `rid`          | <~> | `space_id`                       |
| `createdAt`    | <-> | `created`                        |
| `modifiedAt`   | <-> | `last_modified`                  |
| `authorId`     | <-> | `author_local_id` => `author_id` |
| `metadata`     | <-  | `literal_content`                |

Note on metadata: It is read from the database, but currently not written. We will phase it out.

When some specific keys of `literal_content` are mapped to a CrossApp field, those key-value pairs are not included again in the `metadata`. Thus `metadata` is a grab-bag for residual data. (Eg color for now.)

Residual (not otherwise accounted for) keys in Obsidian frontmatter are mapped to `literal_content->source_data`. (Not through CrossApp.)

#### Matching of CrossAppNodeSchema and Concept

| CrossAppNodeSchema     | Concept                             | value |
| ---------------------- | ----------------------------------- | ----- |
| `label`                | `name`                              | {}    |
| `template`             | `literal_content->template_content` |       |
| `templateTitle`        | `literal_content->template`         |       |
| -                      | `is_schema`                         | true  |
| -                      | `schema_id`                         | null  |
| -                      | `arity`                             | 0     |
| -                      | `is_relation`                       | false |
| `slotDefinition`       | `reference_content`                 |       |
| `keys(slotDefinition)` | `literal_content->roles`            |       |

In the case of a node with ObjectRelations, such as Evidence, we would see something like:

| CrossAppNode           | Concept                  | value                                 |
| ---------------------- | ------------------------ | ------------------------------------- |
| -                      | `arity`                  | 1                                     |
| `slotDefinitions`      | `reference_content`      | {"sourceDocument": <id of Reference>} |
| `keys(slotDefinition)` | `literal_content->roles` | {"roles":["sourceDocument"]}          |

Also note: In Obsidian, where we do not go through CrossAppNodeSchema, the label is also assigned to `literal_content->label`.

Query filter: `.eq("is_relation", false).eq("is_schema", true)`

#### Matching of CrossAppNode and Concept

| CrossAppNode            | Concept                                         | value              |
| ----------------------- | ----------------------------------------------- | ------------------ |
| `content->direct->text` | `name`                                          |                    |
| -                       | `is_schema`                                     | false              |
| -                       | `is_relation`                                   | false              |
| `nodeType`              | `schema_represented_by_local_id` => `schema_id` | ref to Node schema |
| -                       | `arity`                                         | 0                  |
| `slots`                 | `reference_content`                             | {}                 |

In the case of a node with ObjectRelations, such as Evidence, we would see:

| CrossAppNode | Concept             | value                    |
| ------------ | ------------------- | ------------------------ |
| -            | `arity`             | 1                        |
| `slots`      | `reference_content` | {"sourceDocument": <id>} |

The keys of the slots (instance variables) should match those defined in the `literal_content->roles` of the corresponding schema, as shown above.

Query filter: `.eq("is_relation", false).eq("is_schema", false)`

#### Matching of CrossAppRelationTypeSchema and Concept (Obsidian only)

| CrossAppRelationTypeSchema | Concept                          | value                       |
| -------------------------- | -------------------------------- | --------------------------- |
| -                          | `literal_content->roles`         | `["source", "destination"]` |
| -                          | `is_schema`                      | true                        |
| -                          | `schema_id`                      | null                        |
| -                          | `arity`                          | 2                           |
| -                          | `reference_content`              | {}                          |
| `label`                    | `name`, `literal_content->label` |                             |
| `complement`               | `literal_content->complement`    |                             |
| -                          | `is_relation`                    | true                        |

Query filter: `.eq("is_relation", true).eq("is_schema", true).is("reference_content->source", "null")`

#### Matching of Obsidian CrossAppRelationTripleSchema and Concept

| CrossAppRelationTripleSchema | Concept                            | value                          |
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
| -                            | `is_relation`                      | true                           |

Note that the relationType in `reference_content->relation_type` is not here playing the role of a slot definition, as it will not be defined in relation instances; so it does not belong in the roles. It can be thought of as an instance variable of the `CrossAppRelationTripleSchema` class itself.

Theory: If we were materialize five metaclasses for the five kinds of objects, we would define the `relation_type` as a role (`slotDefinition`) of the `CrossAppRelationTripleSchema` metaclass, and its range constraint would have to point for a metaclass corresponding to `RelationTypeSchema`. It may help conceptually, but there is no reason to materialize those metaclasses in the database.

Query filter: `.eq("is_relation", true).eq("is_schema", true).not("reference_content->relation_type", "is", "null")`

#### Matching of Roam CrossAppRelationTripleSchema and Concept

| CrossAppRelationTripleSchema | Concept                          | value                       |
| ---------------------------- | -------------------------------- | --------------------------- |
| `id`                         | `name`                           |                             |
| -                            | `literal_content->roles`         | `["source", "destination"]` |
| -                            | `is_schema`                      | true                        |
| -                            | `schema_id`                      | null                        |
| -                            | `arity`                          | 2                           |
| `label`                      | `literal_content->label`         |                             |
| `complement`                 | `literal_content->complement`    |                             |
| `sourceType`                 | `reference_content->source`      | ref to Node schema          |
| `destinationType`            | `reference_content->destination` | ref to Node schema          |
| -                            | `is_relation`                    | true                        |

Query filter: `.eq("is_relation", true).eq("is_schema", true).not("reference_content->source", "is", "null").is("reference_content->relation_type", "null")`

In most cases, you would want both Roam and Obsidian RelationTripleSchemas, hence you would simply use:

Combined query filter: `.eq("is_relation", true).eq("is_schema", true)`

#### Matching of Obsidian CrossAppRelation and Concept

| CrossAppRelation | Concept                          | value                        |
| ---------------- | -------------------------------- | ---------------------------- |
| -                | `name`                           | composite                    |
| -                | `is_schema`                      | false                        |
| -                | `arity`                          | 2                            |
| `relationType`   | `schema_id` (in Obsidian)        | ref to RelationType schema   |
| `relationType`   | `schema_id` (in Roam)            | ref to RelationTriple schema |
| `source`         | `reference_content->source`      | ref to Node                  |
| `destination`    | `reference_content->destination` | ref to Node                  |
| -                | `is_relation`                    | true                         |

Again, the keys of the slots match those defined in the `literal_content->roles` of the corresponding schema. In the case of relations, those must include `source` and `destination`. Those slot definitions are implicit. We may allow extra slot definitions for relationTypeSchema some day, but those would be besides the implicit `source` and `destination`.

Query filter: `.eq("is_relation", true).eq("is_schema", false)`

### Design considerations and future changes

#### Relations, arity and ObjectProperties

The arity on either a schema or instance is based on the size of the `literal_content->roles` array in the schema. Think of the `roles` literal as a class variable that defines which variables will exist in instances.

The `reference_content` allows either single or multiple values (`Record<string, number|number[]>`). The `reference_content` values are collated in a computed column `refs`, whose index allows for efficient filters on sql queries before digging into the `reference_content` jsonb. Currently, the slots only accommodate single values.

Relations are concepts (schemas or instances) whose schemas have the special roles `source` and `destination`. This is captured in a computed column `is_relation`.

Internal node references such as the Evidence's Source can be expressed using a slotDefinition which will show up in the schema's roles and slots which will show up in the instances' `reference_content`.
