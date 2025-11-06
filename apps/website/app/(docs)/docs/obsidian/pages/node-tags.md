---
title: "Node tags"
date: "2025-10-15"
author: ""
published: true
---

## Overview

Node tags allow you to quickly create discourse nodes from tagged lines in your notes. When you assign a tag to a node type, any line containing that tag becomes a clickable element that can be converted into a discourse node.

This feature streamlines your workflow by letting you mark potential discourse nodes with tags as you write, then easily convert them to full discourse nodes later.

## Setting up node tags

### Configuring tags in settings

1. Open the Discourse Graph settings
2. Navigate to the **Node Types** section
3. Select an existing node type or create a new one
4. In the **Node tag** field, enter a tag identifier

![Node tags setting](/docs/obsidian/node-tags-setting.png)

### Tag naming rules

Tags must follow these rules:
- **No spaces**: Tags cannot contain whitespace
- **Allowed characters**: Only letters (a-z, A-Z), numbers (0-9), and dashes (-)
- **No special characters**: Characters like #, @, /, \, etc. are not allowed
- **Case-sensitive**: Tags are case-sensitive in the editor

#### Tag examples

**Valid tags:**
- `clm-candidate`
- `question-idea`
- `evidence2024`
- `my-argument`

**Invalid tags:**
- `clm candidate` (contains space)
- `#clm-candidate` (contains #)
- `clm/candidate` (contains /)

## Using node tags in your notes

### Adding tags to your notes

Once you've configured a node tag for a node type, simply add the tag (prefixed with `#`) to any line in your notes:

![Node tags example](/docs/obsidian/node-tags-example.png)

### Creating discourse nodes from tags

When you hover over a tagged line, a button appears above the tag:

1. **Hover** over the tag you want to convert
2. Wait for the **"Create [Node Type]"** button to appear
![On hover](/docs/obsidian/on-hover-node-tag.png)
3. **Click** the button to open the node creation dialog
![Node creation dialog](/docs/obsidian/create-node-dialog-node-tag.png)
4. Click "Confirm" to create node

You'll see that the candidate node is now replaced with a formalized node
![node created from tag](/docs/obsidian/node-tag-created.png)
