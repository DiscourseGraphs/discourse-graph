---
title: "Querying your discourse graph"
date: "2026-04-02"
author: ""
published: true
---

As your discourse graph grows, you'll want to view and filter nodes by type — for example, seeing all your Claims or all your Questions in one place. Discourse Graphs integrates with Obsidian's [Bases](https://obsidian.md/blog/bases/) feature to create filtered table views for any node type.

## What is a Base view?

A Base view is a `.base` file that Obsidian renders as a filterable, sortable table. Discourse Graphs can generate these files pre-configured to show only nodes of a specific type, using the `nodeTypeId` frontmatter property as a filter.

## Creating a Base view

There are three ways to create a Base view for a node type:

### From the command palette

1. Open the command palette (`Cmd/Ctrl + P`)
2. Search for "Create Base view for node type"
3. Select the node type you want to query

![base-from-command.png](/docs/obsidian/base-from-command.png)

### From node type settings

1. Open Discourse Graphs settings
2. Click on a node type to edit it
3. Click the **Create Base view** button at the bottom of the edit form

<!-- TODO: Add screenshot of the "Create Base view" button in node type settings -->

![base-from-setting.png](/docs/obsidian/base-from-setting.png)

### From the discourse context panel

When viewing a discourse node, you can create a Base view for its node type directly from the context panel:

1. Open the [Discourse context panel](./discourse-context) for any discourse node
2. Click the table icon next to the node type name

![base-from-context.png](/docs/obsidian/base-from-context.png)

## How it works

Each time you create a Base view, a new `.base` file is created at the root of your vault with the name `{Node Type} Nodes.base` (e.g., `Claim Nodes.base`). If a file with that name already exists, a numbered suffix is added (e.g., `Claim Nodes 1.base`).

The generated file contains a table view filtered to show only nodes matching the selected node type. You can then further customize the view in Obsidian — add columns, change sorting, or add additional filters.

> **Note:** A new Base file is always created rather than opening an existing one. This ensures you always get a fresh view with the correct filter, even if you've modified a previous Base view.
