---
title: "Creating discourse relationships"
date: "2025-01-01"
author: ""
published: true
---

One of the main features of the Discourse Graph extension is the ability to **create formal discourse relations between nodes just by writing and outlining!**

The extension has an in-built [grammar](./grammar) that enables it to recognize when certain patterns of writing and outlining are meant to express particular discourse relations (e.g., support, oppose, inform) between discourse nodes. When it recognizes these patterns, it "writes" them to a formal discourse graph data structure, that you can then use to explore or query your discourse graph.

## Deprecation notice

Pattern-based relations are being deprecated. Please plan to move to [**stored relations**](./stored-relations), which will be the recommended way to define and persist discourse relations. Migration guidance is available in [**Migration to stored relations**](./migration-to-stored-relations).

## Stock Patterns

- Take a look at [Relations Patterns](./relations-patterns)

### Verifying relations

You can verify any created relations by checking the [discourse context](./discourse-context) of the claim, evidence, or question page.

Or by running a [query](./querying-discourse-graph) for the specific relation.

## Digging deeper

Want to recognize other patterns that aren't listed here? Or don't like these? You can [change them](./extending-personalizing-graph)! But you might first want to [understand how the grammar works](./grammar).
