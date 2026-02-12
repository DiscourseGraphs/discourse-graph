# Drag and Drop Testing Guide for ENG-1368

This guide describes how to test the drag-and-drop functionality for Discourse Nodes into tldraw Canvas.

## Feature Overview

Users can now drag Discourse Nodes (files with `nodeTypeId` in frontmatter) from Obsidian's file system directly into a Canvas, which will create a corresponding DiscourseNodeShape.

## Test Scenarios

### 1. Drag from File Explorer (Sidebar)

**Steps:**
1. Open Obsidian with the Discourse Graphs plugin enabled
2. Create or identify a Discourse Node (a file with `nodeTypeId` in its frontmatter)
3. Open a Canvas file
4. In the left sidebar file explorer, locate the Discourse Node
5. Click and drag the file from the file explorer
6. Drop it onto the Canvas

**Expected Result:**
- A DiscourseNodeShape should appear at the drop location
- The shape should display the file's title
- The shape should have the correct node type color
- If the node type has `keyImage` enabled and the file contains an image, it should be displayed
- A success toast should appear: "Node Added: [node type]: [filename]"

**Error Cases:**
- If you drag a regular markdown file (not a Discourse Node), nothing should happen (no error)
- If the node type is not found, a warning toast should appear

### 2. Drag from Base Query Results

**Steps:**
1. Open a page with base query results showing Discourse Nodes
2. Open a Canvas file
3. Drag a Discourse Node link from the query results
4. Drop it onto the Canvas

**Expected Result:**
- Same as scenario 1

### 3. Drag from Open Page/Sidebar Panel

**Steps:**
1. Open multiple Discourse Node pages in tabs or sidebar panels
2. Open a Canvas file
3. From the file explorer or sidebar, drag one of the open Discourse Node files
4. Drop it onto the Canvas

**Expected Result:**
- Same as scenario 1

### 4. Multiple Nodes

**Steps:**
1. Open a Canvas
2. Drag and drop multiple different Discourse Nodes one by one
3. Verify each creates its own shape

**Expected Result:**
- Each node should create a separate DiscourseNodeShape
- Each should be positioned where it was dropped
- All shapes should be properly styled according to their node types

### 5. Edge Cases

**Test dragging non-Discourse files:**
- Drag a regular markdown file without `nodeTypeId`
- Expected: Should be ignored (no shape created, no error)

**Test dragging with invalid node type:**
- Drag a file with a `nodeTypeId` that doesn't exist in settings
- Expected: Warning toast about unknown node type

**Test dragging from external sources:**
- Try dragging from external file manager
- Expected: Should be handled normally by tldraw (image/file handling)

## Technical Details

### Implementation Files
- `/apps/obsidian/src/components/canvas/utils/dropHandler.ts` - Main drop handling logic
- `/apps/obsidian/src/components/canvas/TldrawViewComponent.tsx` - Drop event listeners

### Key Functions
- `isDiscourseNode()` - Checks if a file has `nodeTypeId` in frontmatter
- `handleCanvasDrop()` - Processes drop events and creates DiscourseNodeShapes
- `extractFilePathFromDragData()` - Extracts file path from drag event data

### Data Flow
1. User drags file from Obsidian file system
2. Drop event fires on canvas container
3. `extractFilePathFromDragData()` extracts the file path (handles wikilink and plain path formats)
4. File is resolved using `app.metadataCache.getFirstLinkpathDest()`
5. `isDiscourseNode()` checks for `nodeTypeId` in frontmatter
6. If valid, a block reference is created in the canvas file
7. Node metadata is retrieved (type, image, size)
8. DiscourseNodeShape is created at drop position
9. Success/error toast is shown

## Debugging

If drag-and-drop doesn't work:

1. Check browser console for errors
2. Verify the file has `nodeTypeId` in frontmatter:
   ```yaml
   ---
   nodeTypeId: some-node-type-id
   ---
   ```
3. Check that the node type exists in plugin settings
4. Verify the canvas file is properly loaded
5. Check that event listeners are attached (inspect in DevTools)

## Related Issues

- Linear Issue: ENG-1368
- Branch: `cursor/ENG-1368-discourse-node-canvas-drop-bf14`
