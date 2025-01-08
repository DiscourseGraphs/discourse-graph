---
title: "Querying Discourse Graph"
date: "2025-01-01"
author: ""
published: true
---

## Query Drawer

The query drawer component allows you to construct structured queries over your discourse graph, based on discourse relations (e.g., "find all evidence that supports/opposes a claim"), and reason over the results in a structured, tabular format (e.g., "find all evidence that supports a claim, and allow me to filter/sort by methodological details").

### Making a query

Use Command Palette (⌘+`P` on Mac,`CTRL`\+ `P` otherwise) to access the query drawer.

![](/docs/roam/command-palette-query-drawer.png)

A query drawer component will open from the left. From there, you can construct structured queries of your discourse graph and explore their results in a tabular format.

![](/docs/roam/query-drawer.png)

## Common Query Examples

### Evidence that Informs a Question

![](/docs/roam/query-drawer-informs.png)

### Evidence that Supports a Claim

![](/docs/roam/query-drawer-supports.png)

## Advanced Query Examples

### Mix discourse and Roam queries

Example: find all evidence that informs a question, but only if it was collected in a specific location (this example assumes at least some evidence pages have an attribute `Location::` in them)

![](/docs/roam/query-drawer-advanced.png)

### Select node attributes to display as attributes of results

Example: find all evidence that informs a question, and select a methods attribute to display so we can sort/filter on it (this example assumes at least some evidence pages have an attribute `testingRegime::` in them)

![](/docs/roam/query-drawer-advanced2.png)

### Select discourse attributes to display as attributes of results

If you have defined [Discourse Attributes](./discourse-attributes) for the node you want to query, you can select it as a column in your query. The syntax for accessing a node's discourse attribute as a select is`discourse:discourseAttributeName`.

Example: find all claims and display their "Evidence" discourse attributes (number of supporting evidence relations) as a column.

![](/docs/roam/query-drawer-advanced3.png)

## Naming a query

You can name a query if you like!

![](/docs/roam/query-drawer-naming.gif)

## Saving a query to its own page

You can save a query to its own page if you want to keep it around for easier access.

![](/docs/roam/query-drawer-save-to-page.png)

It will be saved to the namespace `discourse-graph/queries/` by default.
