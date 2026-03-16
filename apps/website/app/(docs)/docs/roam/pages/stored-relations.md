---
title: "Stored relations"
date: "2025-01-01"
author: ""
published: true
---

## Overview

Stored relations are explicit relationships between discourse nodes. They are created directly in the graph and saved as data, so they can be used consistently across overlays, queries, and canvases.

## What is a stored relation?

A stored relation connects two discourse nodes with a named relation type, such as a claim supporting another claim or a source informing a question.

Stored relations are:

- Created directly in the [**Discourse context overlay**](./discourse-context-overlay)
- Persisted in your graph as structured data
- Available anywhere Discourse Graph reads relationships

## Why use stored relations?

Stored relations give you a more direct and predictable way to work with relationships in your graph.

- **Fast to read**
  - Relations are loaded directly from stored data
  - The Discourse context overlay can resolve them quickly
- **Stable over time**
  - Relations do not depend on formatting or page structure
  - Editing nearby text does not change the relation itself
- **Easy to understand**
  - A relation exists because you created it
  - Deleting a relation removes it explicitly

## Creating stored relations

Typical flow:

1. Open the Discourse context overlay for a node.
2. Click **Add relation**.
3. Select the relation type.
4. Select the source and destination nodes.
5. Save the relation.

The relation is stored immediately.

## Viewing stored relations

Stored relations appear throughout Discourse Graph:

- The [**Discourse context overlay**](./discourse-context-overlay) shows relations for the current node
- Queries can resolve relations from stored data
- Canvases can use the same stored relationships

## Editing and deleting stored relations

- Stored relations can be deleted directly from the Discourse context overlay
- If you want to change a relation, the usual flow is to delete the old one and create the new one
- Relation labels are referenced by node identity, so renaming a relation label updates the associated relations automatically

## Multi-user behavior

Stored relations are shared across the graph.

- Teammates working in the same graph see the same stored relations
- Changes to stored relations are available to other users in that graph

## For the technically inclined

Stored relations are implemented as:

- One block per relation
- Located at: `roam/js/discourse-graph/relations`
- Relation data stored in the block's hidden properties
- Source and destination nodes referenced by UID

This structure allows fast lookup, consistent rendering, and future extensions such as metadata, provenance, and annotations.
