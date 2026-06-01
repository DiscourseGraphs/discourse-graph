---
title: "Creating discourse nodes"
date: "2025-01-01"
author: ""
published: true
---

Discourse nodes are Obsidian notes with Discourse Graph metadata (node type, relations, etc.). You can create them from selected text, from scratch, by converting an embedded image, by converting an existing note, from node tags, or from a canvas.

## Create a discourse node from selected text

When you start from a selection, the plugin opens the **Create discourse node** modal pre-filled with the selected text.

### Option A: Hotkey (node type picker)

1. Select text in your note
2. Press your configured hotkey (default is `\`)
3. Pick a node type in the popup
4. Review and confirm in the **Create discourse node** modal

![hotkey](/docs/obsidian/hot-key-create-node.png)

### Option B: Right-click menu (“Turn into discourse node”)

1. Select text in your note
2. Right-click the selection
3. Choose a node type under **Turn into discourse node**
4. Review and confirm in the **Create discourse node** modal

![right-click](/docs/obsidian/right-click-create-node.png)

### Option C: Command palette (“Create discourse node”)

1. Select text in your note (optional)
2. Open the command palette
3. Run **Create discourse node**
4. Review and confirm in the **Create discourse node** modal

![command](/docs/obsidian/command-create-node.png)

- **Content field**: Auto-resizes as you type and enforces Obsidian’s filename byte
  limit.
- **Type field**: In create mode, you can change the node type until you confirm.
- **Search existing nodes**: In most create flows, typing shows matching existing
  nodes; selecting one inserts it instead of creating a new file.
  - The file explorer **Convert into** flow disables this search.
- **Relationship with “…”** (optional): If you start from a note (selection, node
  tag, or canvas), you may see a relationship selector to relate the created/selected
  node to the current file.
- **Insert backlink** (optional): In create mode, you can choose whether the plugin
  inserts a backlink in the current note when you confirm.

## Convert an embedded image into a discourse node

For images embedded in a note (for example `![[photo.png]]`):

1. Open the note in **Live Preview** or **Reading** view
2. Click the embedded image (the **Convert to node** button appears on the embed, similar to Obsidian’s edit-block control)
3. Click **Convert to node**
4. In the **Create discourse node** modal, choose a node type, enter a title, and click **Confirm**

The plugin creates the discourse node, adds the image to that node’s note, and replaces the embed in your current note with a link to the new node.

![image-convert](/docs/obsidian/image-embed-create-node.png)

## Convert an existing page into a discourse node

If a page is not already a discourse node, you can convert it.

1. In the file explorer, right-click a note
2. Choose **Convert into**, then pick a node type
3. Review and confirm in the **Modify discourse node** modal

Note: In this flow, the modal is **create-only** (it does not offer “search existing nodes”) because the intent is to convert the current file into a new discourse node.

![file-exporer-convert](/docs/obsidian/file-explorer-convert.png)

You can perform the same function from the file menu
![file-menu](/docs/obsidian/file-menu-convert-2.png)

## Create nodes from node tags

If you use [node tags](/docs/obsidian/core-features/node-tags), you can hover a tag and click **Create [Node type]** to open the modal.

## Create nodes from a canvas

On a Discourse Graph canvas, creating a node opens the same modal, and then adds the node as a new canvas shape.

## Node templates

When creating a node, if you've configured a [template for that node type](/docs/obsidian/configuration/node-types-templates#working-with-templates), the template content will be automatically applied to the new node.

The new node will be saved in the designated folder that you created in the [General settings](/docs/obsidian/configuration/general-settings).

## Related

After creating nodes:

- [Create relationships between nodes](/docs/obsidian/core-features/creating-discourse-relationships)
- [Explore your graph on the canvas](/docs/obsidian/core-features/canvas)
