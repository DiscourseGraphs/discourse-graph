---
title: "Canvas"
date: "2025-01-01"
author: ""
published: true
---

The canvas feature in Discourse Graph provides an interactive visual workspace for creating and connecting discourse nodes and relations. Built on top of tldraw, it allows you to visually map out discourse structures with drag-and-drop functionality, adding other visual elements like texts, scribbles, embeddings, and images.

## Creating a new canvas

### Using the command palette

1. Open the command palette (`Cmd/Ctrl + P`)
2. Search for "Create new Discourse Graph canvas"
3. Press Enter to create a new canvas

![Create canvas command](/docs/obsidian/create-canvas-command.png)
The canvas will be created in your configured canvas folder (default: `Discourse Canvas/`) with a timestamp-based filename like `Canvas-2025-01-15-1430.md`.

## Opening and viewing canvas

### Opening a canvas

1. Open the file of the canvas
2. In case the file is still in markdown format, you can open the canvas mode by either

Using the command palette

![Open canvas command](/docs/obsidian/open-canvas-command.png)
Or click on the canvas icon at the top right corner
![Canvas icon button](/docs/obsidian/canvas-icon-button.png)

**WARNING: DO NOT MODIFY MARKDOWN CONTENT OF FILE**

## Discourse nodes

You can add discourse nodes to a canvas in several ways. Most flows open the **Create discourse node** modal, where you can create a new node or search for and select an existing one.

### Create a new node

1. Click the **Discourse Graph** icon in the bottom toolbar
2. In the panel on the right, click a node type to select it (or drag a node type onto the canvas)
3. Click on the canvas where you want the node
4. In the **Create discourse node** modal, enter a title, confirm the node type, and click **Confirm**

The new node appears on the canvas as a discourse node card linked to the note that was created.

![Create discourse node](/docs/obsidian/create-discourse-node.gif)

### Add an existing node

**From the create-node modal**

When the modal opens (for example after clicking the canvas with a node type selected), type in the **Content** field to search for existing discourse nodes. Select a result to place that node on the canvas instead of creating a new file.

**By dragging onto the canvas**

Only notes that are already discourse nodes (with a configured `nodeTypeId` in frontmatter) can be dropped. If the same node is already on the canvas, the existing card is selected instead of duplicating it.

_From the file explorer_

1. In the Obsidian file explorer, drag a discourse node note onto the canvas
2. The node is added at the drop location

_From the editor_

When a Discourse Graph canvas is open, internal links in **Live Preview** show a small drag handle (⠿) after the link.

1. In a note, find a wikilink or markdown link to a discourse node (for example `[[CLM - My claim]]`)
2. Drag using the handle next to the link
3. Drop onto the canvas

The handle appears for `[[wikilinks]]` and `[markdown links](path.md)` that point to notes in your vault. It does not appear on image embeds (`![[...]]`).

![drag-node](/docs/obsidian/drag-node-shape.png)

### Convert text or image shapes into a node

Turn tldraw text or image shapes into discourse nodes without leaving the canvas:

1. Select a **text** or **image** shape on the canvas
2. Right-click the shape
3. Choose a node type from the **Convert to** submenu
4. In the modal, edit the title (text is pre-filled; images start with an empty title) or search for an existing node
5. Click **Confirm** — the shape is replaced with a discourse node card

## Discourse relations

### Create new relations between nodes

- Click the discourse node icon in the toolbar
- Click the type of relations you want to create between two nodes
- Click and drag the arrow from the source node to target node

![Create relations](/docs/obsidian/create-relations.gif)

_Note_: The relation type selected must be compatible between the source and target nodes. Otherwise, you will receive a relation tool error. To update the setting on what relation types are possible between two kinds of discourse nodes, you can change the setting [Relation types setting](/docs/obsidian/configuration/relationship-types#configuring-valid-relationships)

![Relation error](/docs/obsidian/relation-error.png)

### Adding existing relations

- Click on the discourse node you're trying to add existing relations of
- Click on the "Relations" button that pops up. You'll see a panel showing all the relations that this node has
- Click on the '+' or '-' to add these relations to the canvas
  - For relations whose target discourse node isn't on canvas yet, it will be added to the canvas along with the relation

![Adding existing relations](/docs/obsidian/adding-existing-relations.gif)

## Canvas Features

### Key figures

You can choose to show the first image of discourse nodes of certain type. To change the setting on whether this first image show up, you can edit it in the Node Type Setting

![Key figure](/docs/obsidian/key-figure.png)

Then you will see the image show up if any is present in the file.

![Key figure example](/docs/obsidian/key-figure-example.png)

### Open discourse node files

- To open a discourse node to the side panel, you can press Shift + Click, or click on the sidebar icon when hover on discourse node.
- To open file to a new tab, you can press Cmd + click on the file

### Auto-save

- Changes are automatically saved to the markdown file
- No manual save required
- File updates preserve the markdown structure and block references

### Export Options

- **Markdown View**: Switch to see the underlying markdown structure
- **SVG Export**: Export canvas as SVG image (via tldraw)
- **PNG Export**: Export canvas as PNG image (via tldraw)

![Export options](/docs/obsidian/export-options.png)

## Troubleshooting

### Common Issues

**Canvas Won't Load**:

- Check that the file has proper frontmatter with `tldr-dg: true`
- Verify the JSON data block is properly formatted
- Try switching to markdown view and back to canvas view

**Relations Won't Connect**:

- Ensure the node types allow the relation type you're trying to create
- Check your discourse relation configuration in settings
- Verify both nodes are valid discourse nodes

**Performance Issues**:

- Consider splitting large canvases into multiple smaller ones
- Close other resource-intensive applications

**Search Not Working**:

- Verify nodes have proper frontmatter with `nodeTypeId`
- Check that the Obsidian metadata cache is up to date
- Try restarting Obsidian to refresh the cache

### Getting Help

If you encounter issues with the canvas feature, reach out to our dev team via [Slack](https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg)
