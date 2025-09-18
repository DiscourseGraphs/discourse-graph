---
title: "Canvas"
date: "2025-01-01"
author: ""
published: true
---
The Canvas feature in Discourse Graph provides an interactive visual workspace for creating and connecting Discourse Nodes and Relations. Built on top of tldraw, it allows you to visually map out discourse structures with drag-and-drop functionality, adding other visual elements like texts, scribbles, embeddings, and images.

## Creating a New Canvas

### Using the Command Palette

1. Open the Command Palette (`Cmd/Ctrl + P`)
2. Search for "Create new Discourse Graph canvas"
3. Press Enter to create a new canvas

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F_uF6WGGgga.png?alt=media&token=4fd61b3c-3a50-48bb-b034-b5e0a8156c8f)
The canvas will be created in your configured canvas folder (default: `Discourse Canvas/`) with a timestamp-based filename like `Canvas-2024-01-15-1430.md`.

## Opening and Viewing Canvas

### Opening a Canvas
1. Open the file of the canvas
3. In case the file is still in markdown format, you can open the canvas mode by either

Using the command pallete

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FxhxReS4Ylp.png?alt=media&token=f04ec9da-5282-45fa-b989-60f08ea0b8d6)
Or click on the Canvas icon at the top right corner
![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FDziMHaUNq9.png?alt=media&token=85e2ed2d-01b0-49ac-ae05-a34e20218a5a)


***Warning*: DO NOT MODIFY MARKDOWN CONTENT OF FILE**

## Adding Nodes to Canvas

### Creating New Discourse Nodes

1. **Using the Discourse Node Tool**:
   - Click the Discourse Node icon in the toolbar
   - Select a node type from the right side panel
   - Click anywhere on the canvas to place a new node
   - Or drag the selected node type to the canvas
   - Enter the node title in the modal that appears

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FdbRAlJh5_u.gif?alt=media&token=60b5243d-24e2-4fd4-af64-2559a621060e)


### Adding Existing Nodes

1. **Using Node Search**:
   - Use the search bar in the top-left of the canvas
   - Type to search for existing Discourse Nodes
   - Click on a node from the search results to add it to the canvas

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F1DYLHGFHbN.gif?alt=media&token=41d4460a-9ab6-4030-8631-da8c2a2d3a67)

2. **Search Filtering**:
   - When a specific node type is selected, search results are filtered to that type

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FN13Z9wOnV7.gif?alt=media&token=ba074ebf-e784-43b8-8bb3-ec1118633684)


## Creating Relations Between Nodes
### Create New Relations Between Nodes
   - Click the Discourse Node icon in the toolbar
   - Click the type of relations you want to create between two nodes
   - Click and drag the arrow from the source node to target node

   ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F2a7TPGvtu1.gif?alt=media&token=bc64816e-076f-496c-848d-9c112a9cbe08)

   *Note*: The relation type selected must be compatible between the source and target nodes. Otherwise, you will receive a relation tool error. To update the setting on what relation types are possible between two kinds of Discourse Nodes, you can change the setting [Relation Types setting](./relationship-types#configuring-valid-relationships)

   ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FQFCi5Oh7Fa.png?alt=media&token=0d894824-6c07-4551-9596-1c8c66ab4979)
### Adding Existing Relations
   - Click on the Discourse Node you're trying to add existing relations of
   - Click on the "Relations" button that pops up. You'll see a panel showing all the relations that this node has
   - Click on the '+' or '-' to add these relations to the canvas
      + For relations whose target Discourse Node isn't on canvas yet, it will be added to the canvas along with the relation


   ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FHDdXVYgVDx.gif?alt=media&token=d42ca7be-59f2-43f8-a04b-8f685df4d4b8)

## Canvas Features

### Auto-save

- Changes are automatically saved to the markdown file
- No manual save required
- File updates preserve the markdown structure and block references

### Export Options

- **Markdown View**: Switch to see the underlying markdown structure
- **SVG Export**: Export canvas as SVG image (via tldraw)
- **PNG Export**: Export canvas as PNG image (via tldraw)

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F0_YqSWn-Ll.png?alt=media&token=45d699b0-caf2-4a2f-85ef-bd40510db0fb)

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