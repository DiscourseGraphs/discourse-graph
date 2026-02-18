---
title: "Stored relations"
date: "2025-01-01"
author: ""
published: true
---

## Stored relations

### Overview

Stored relations change how relationships between discourse nodes are created and managed.

Instead of being inferred from patterns in your Roam graph, **stored relations are created and deleted explicitly** and saved as data. This makes relations faster to query, more reliable, and easier to manage.

Stored relations are the foundation for improved performance and a more usable Discourse context overlay.

### What is a stored relation?

A **stored relation** is an explicit relationship between two discourse nodes (for example, a claim supporting or opposing another claim).

- Created directly in the [**Discourse context overlay**](./discourse-context-overlay)
- Persisted as data in your graph
- Independent of page structure or pattern matching

Once created, stored relations behave consistently across queries, canvases, and overlays.

### Why stored relations?

Stored relations provide several benefits over pattern-based relations:

- **Faster performance**
  - Relations are read directly from stored data
  - The global Discourse context overlay loads significantly faster
- **More predictable behavior**
  - Relations do not disappear due to formatting or structural changes
  - Editing text or reorganizing blocks does not affect relations
- **Clearer mental model**
  - Relations exist because you created them
  - Deleting a relation removes it explicitly

### Creating stored relations

Stored relations are created from the [**Discourse context overlay**](./discourse-context-overlay).

Typical flow:

1. Open the Discourse context overlay for a node
2. Click **Add relation**
3. Select the relation type
4. Select the source and destination nodes

The relation is immediately stored and available to all users who have enabled stored relations.

### Viewing stored relations

When stored relations are enabled:

- The [Discourse Context Overlay](./discourse-context-overlay) shows **only stored relations**
- Queries and canvases resolve relations from stored data
- Pattern-based relations are ignored

This ensures consistent and fast results.

### Editing and deleting stored relations

- Stored relations can be **deleted explicitly** from the Discourse context overlay
- In most cases, editing a relation is equivalent to:
  - Deleting the old relation
  - Creating a new one

Relation labels are referenced by node identity, so renaming a relation label updates all associated relations automatically.

### Multi-user behavior

Stored relations are shared across the graph:

- All users with stored relations enabled see the same relations
- Users without stored relations enabled will not see them
- Mixed usage is supported temporarily during the transition period

For details on migrating and mixed-mode behavior, see the [**stored relations migration**](./migration-to-stored-relations) documentation.

### Current limitations and notes

- Stored relations are **not inferred** from patterns
- Creating or deleting patterns does not affect stored relations
- Stored relations are currently opt-in during the transition period

These limitations will be removed once stored relations become the default.

### For the technically inclined

Stored relations are implemented as:

- One block per relation
- Located at: `roam/js/discourse-graph/relations`
- Relation data stored in the block’s hidden properties
- Source and destination nodes referenced by UID

This structure allows fast lookup, consistent rendering, and future extensions (metadata, provenance, annotations).

### Future direction

Stored relations will eventually replace pattern-based relations entirely.

Once the transition period ends:

- Stored relations will be the default
- Pattern-based relations will be phased out
- Migration will be handled automatically

Until then, stored relations are available as an opt-in feature for users who want improved performance and reliability.
