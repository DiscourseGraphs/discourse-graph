# L. Portable package JSON model based on current Obsidian-to-Obsidian sync

## Purpose

This note models what the current Obsidian-to-Obsidian sync behavior would look like if we expressed it as a portable package.

It is intentionally grounded in the current implementation. It is not the ideal final design.

## Short answer

Based on the current Obsidian-to-Obsidian flow, the cleanest package model is a JSON manifest that precomputes the same information the importer currently fetches from Supabase.

For an actual transport artifact, the better packaging choice is:

- `bundle.json` for the manifest
- `assets/` for binary files
- wrapped in a `.zip`

That is better than a single giant JSON blob because the current flow imports binary assets, not just metadata.

For design work and APIs, JSON is still the right primary shape.

## Important scope rule

If we want to "sync one node" and preserve current Obsidian behavior, the package cannot literally contain only one node.

It needs a one-hop bundle:

- the root node
- the schemas needed for that node
- any directly connected relations we want to preserve
- the counterpart nodes for those relations
- the schemas needed for those counterpart nodes
- assets used by any included note

Otherwise current relation behavior becomes lossy, because the current importer only materializes relations when both endpoints resolve locally.

## Closest current-model JSON

```json
{
  "version": "dg-portable-package/v0",
  "kind": "node-bundle",
  "rootNodeId": "orn:obsidian.note:obsidian://vault/research-vault/8d8d7c56",
  "source": {
    "app": "obsidian",
    "spaceUri": "obsidian://vault/research-vault",
    "spaceName": "Research Vault",
    "exportedAt": "2026-04-12T18:30:00Z"
  },
  "nodes": [
    {
      "id": "orn:obsidian.note:obsidian://vault/research-vault/8d8d7c56",
      "sourceLocalId": "8d8d7c56",
      "nodeTypeId": "claim",
      "title": "Exercise improves mood",
      "createdAt": "2026-04-10T10:00:00Z",
      "modifiedAt": "2026-04-12T09:30:00Z",
      "originalFilePath": "Discourse Nodes/Claims/Exercise improves mood.md",
      "content": {
        "format": "text/markdown",
        "markdown": "---\nnodeTypeId: claim\nnodeInstanceId: 8d8d7c56\npublishedToGroups:\n  - team-1\n---\nExercise improves mood.\n\n![[images/chart.png]]\n"
      },
      "assetIds": ["asset:sha256:chart-png"]
    },
    {
      "id": "orn:obsidian.note:obsidian://vault/research-vault/4a4b2c11",
      "sourceLocalId": "4a4b2c11",
      "nodeTypeId": "evidence",
      "title": "Study 2024 trial result",
      "createdAt": "2026-04-09T08:00:00Z",
      "modifiedAt": "2026-04-12T09:00:00Z",
      "originalFilePath": "Discourse Nodes/Evidence/Study 2024 trial result.md",
      "content": {
        "format": "text/markdown",
        "markdown": "---\nnodeTypeId: evidence\nnodeInstanceId: 4a4b2c11\n---\nParticipants reported improved mood after 6 weeks.\n"
      },
      "assetIds": []
    }
  ],
  "nodeTypes": [
    {
      "id": "claim",
      "rid": "orn:obsidian.schema:obsidian://vault/research-vault/claim",
      "name": "Claim",
      "literalContent": {
        "label": "Claim",
        "template": "",
        "source_data": {
          "format": "CLM - {content}",
          "color": "#3b82f6",
          "tag": "claim",
          "keyImage": false
        }
      }
    },
    {
      "id": "evidence",
      "rid": "orn:obsidian.schema:obsidian://vault/research-vault/evidence",
      "name": "Evidence",
      "literalContent": {
        "label": "Evidence",
        "template": "",
        "source_data": {
          "format": "EVD - {content}",
          "color": "#10b981",
          "tag": "evidence",
          "keyImage": false
        }
      }
    }
  ],
  "relationTypes": [
    {
      "id": "supports",
      "rid": "orn:obsidian.schema:obsidian://vault/research-vault/supports",
      "name": "supports",
      "literalContent": {
        "roles": ["source", "destination"],
        "label": "supports",
        "complement": "supported by"
      }
    }
  ],
  "relations": [
    {
      "id": "orn:obsidian.relation:obsidian://vault/research-vault/rel-223",
      "sourceLocalId": "rel-223",
      "relationTypeId": "supports",
      "sourceNodeId": "orn:obsidian.note:obsidian://vault/research-vault/4a4b2c11",
      "destinationNodeId": "orn:obsidian.note:obsidian://vault/research-vault/8d8d7c56",
      "sourceNodeTypeId": "evidence",
      "destinationNodeTypeId": "claim",
      "createdAt": "2026-04-12T09:01:00Z",
      "modifiedAt": "2026-04-12T09:01:00Z"
    }
  ],
  "assets": [
    {
      "id": "asset:sha256:chart-png",
      "filepath": "images/chart.png",
      "mimeType": "image/png",
      "createdAt": "2026-04-11T14:00:00Z",
      "modifiedAt": "2026-04-12T09:20:00Z",
      "storage": {
        "kind": "inline-base64",
        "base64": "iVBORw0KGgoAAAANSUhEUgAA..."
      }
    }
  ]
}
```

## Why these sections exist

These sections map closely to what the current importer needs from shared persistence.

### `nodes`

This is the package form of what the current importer assembles from note content queries and local file writes.

It needs to carry:

- stable ID
- source-local ID
- node type ID
- title
- created and modified timestamps
- original file path
- note content
- asset references

### `nodeTypes`

This is what the importer needs in order to match or create local node types.

It needs to carry:

- schema ID
- stable source identity
- display name
- enough schema metadata to reconstruct local settings such as format, color, tag, template, and key image

### `relationTypes`

This is what the importer needs in order to match or create local relation types.

It needs to carry:

- relation schema ID
- stable source identity
- name or label
- role list
- complement

### `relations`

This is the package form of the relation instance records currently reconstructed from `my_concepts`.

It needs to carry:

- relation ID
- source-local relation ID
- relation type ID
- source node ID
- destination node ID
- source node type ID
- destination node type ID
- timestamps

### `assets`

This is the package form of what is currently supplied by `FileReference` plus storage download.

It needs to carry:

- asset ID
- filepath
- mime type
- created and modified timestamps
- actual file bytes

## What is strictly required for one-node sync

If we want the package to reproduce current Obsidian import behavior for one selected node, these are the required pieces.

### Root node note

- stable ID
- source-local ID
- node type ID
- title
- created and modified timestamps
- original file path
- note content

### Node type schema for the root node

- ID
- name
- enough metadata to rebuild local node type settings

### Directly connected relation instances we want preserved

- relation ID
- relation type ID
- source node ID
- destination node ID
- timestamps

### Counterpart nodes for those relations

If we do not include them, the current relation import behavior becomes incomplete.

The current importer only imports relations when both endpoints resolve.

### Node type schemas for counterpart nodes

These are required if counterpart nodes are included.

### Relation type schemas

These are required so the importer can map or create local relation types.

### Assets referenced by included notes

- file path
- mime type
- file bytes
- created and modified timestamps

## What is not strictly required for current Obsidian import

These are useful, but not necessary to reproduce today’s behavior.

- DB-native numeric IDs like `space_id`, `Concept.id`, `Content.id`
- separate `Document` rows as top-level package objects
- access or publication data such as `SpaceAccess`, `ResourceAccess`, or `publishedToGroups`
- embeddings
- a separate triple-schema section

On that last point, the current importer does not need a remote triple-schema object. It recreates the local triple from:

- source node type
- relation type
- destination node type

So if we want the package to stay close to current behavior, `relationTriples` can be omitted.

## One important caveat

The JSON above is the closest package shape to the current implementation because the current importer still expects markdown content with frontmatter embedded in the note body.

That is why the example uses:

```json
"content": {
  "format": "text/markdown",
  "markdown": "--- ... ---"
}
```

If we want the cleaner future-facing shape, the first thing to change is:

- replace `content.markdown` with canonical `content.atjson`

The rest of the envelope can stay mostly the same.

## Recommendation

1. For the logical package spec and API shape, use JSON.
2. For the actual transport artifact, use `zip + bundle.json + assets/`.
3. For the current Obsidian implementation with minimal churn, keep note content as markdown-in-JSON first.
4. For the future v0 target, replace that one field with `ATJSON`.

## Main takeaway

The current Obsidian-to-Obsidian flow already tells us what the portable package must contain:

- node identity
- schema identity
- node type metadata
- relation type metadata
- relation instances
- enough endpoint identity to reconnect relations locally
- content
- origin metadata
- file assets

What the current system does **not** yet give us is a clean transport boundary.

That is exactly where the portable package should fit.
