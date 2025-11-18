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

![Create Canvas Command](/docs/obsidian/create-canvas-command.png)
The canvas will be created in your configured canvas folder (default: `Discourse Canvas/`) with a timestamp-based filename like `Canvas-2025-01-15-1430.md`.

## Opening and viewing canvas

### Opening a canvas
1. Open the file of the canvas
2. In case the file is still in markdown format, you can open the canvas mode by either

Using the command palette

![Open Canvas Command](/docs/obsidian/open-canvas-command.png)
Or click on the canvas icon at the top right corner
![Canvas Icon Button](/docs/obsidian/canvas-icon-button.png)


**WARNING: DO NOT MODIFY MARKDOWN CONTENT OF FILE**

## Discourse Nodes

### Creating new discourse nodes

**Using the discourse node tool**
   - Click the discourse node icon in the toolbar
   - Select a node type from the right side panel
   - Click anywhere on the canvas to place a new node
   - Or drag the selected node type to the canvas
   - Enter the node title in the modal that appears

![Create Discourse Node](/docs/obsidian/create-discourse-node.gif)


### Adding existing nodes

**Using node search**
   - Use the search bar in the top-right of the canvas
   - Type to search for existing Discourse Nodes
   - Click on a node from the search results to add it to the canvas

![Node Search](/docs/obsidian/node-search.gif)

**Search filtering**
   - When a specific node type is selected, search results are filtered to that type

![Search Filtering](/docs/obsidian/search-filtering.gif)


## Discourse relations
### Create new relations between nodes
   - Click the discourse node icon in the toolbar
   - Click the type of relations you want to create between two nodes
   - Click and drag the arrow from the source node to target node

   ![Create Relations](/docs/obsidian/create-relations.gif)

   *Note*: The relation type selected must be compatible between the source and target nodes. Otherwise, you will receive a relation tool error. To update the setting on what relation types are possible between two kinds of Discourse Nodes, you can change the setting [Relation Types setting](./relationship-types#configuring-valid-relationships)

   ![Relation Error](/docs/obsidian/relation-error.png)
### Adding existing relations
   - Click on the discourse node you're trying to add existing relations of
   - Click on the "Relations" button that pops up. You'll see a panel showing all the relations that this node has
   - Click on the '+' or '-' to add these relations to the canvas
      + For relations whose target Discourse Node isn't on canvas yet, it will be added to the canvas along with the relation


   ![Adding Existing Relations](/docs/obsidian/adding-existing-relations.gif)

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

![Export Options](/docs/obsidian/export-options.png)

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