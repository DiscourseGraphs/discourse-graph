---
title: "Creating discourse relationships"
date: "2025-01-01"
author: ""
published: true
---

The extension has an in-built [grammar](./grammar) that enables it to recognize when certain patterns of writing and outlining are meant to express particular discourse relations (e.g., support, oppose, inform) between discourse nodes. When it recognizes these patterns, it "writes" them to a formal discourse graph data structure, that you can then use to explore or query your discourse graph.

Pattern-based relations are a legacy workflow and are being deprecated. New Discourse Graph installs (as of v0.18.0) use [**stored relations**](./stored-relations) by default. Migration guidance for older installs is available in [**Migration to stored relations**](./migration-to-stored-relations).

## Get started

- Take a look at [Relations Patterns](./relations-patterns)
- Open the [Discourse context overlay](./discourse-context-overlay)
- Create and explore relations in your graph

Want to recognize other patterns that aren't listed here? Or don't like these? You can [change them](./extending-personalizing-graph)! But you might first want to [understand how the grammar works](./grammar).
