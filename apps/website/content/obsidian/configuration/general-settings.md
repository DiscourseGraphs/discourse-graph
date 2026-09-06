---
title: "General settings"
date: "2025-06-27"
author: ""
published: true
---

The General settings page in the Discourse Graph plugin provides fundamental configuration options that affect how the plugin operates. Here are the available settings:

## Show IDs in frontmatter

This setting controls the visibility of identifiers in your note's frontmatter section.

- When enabled, node type IDs and relation type IDs will be visible in the frontmatter of your notes
- When disabled, these IDs will be hidden from view
- This can be useful if you prefer a cleaner frontmatter appearance while still maintaining the underlying structure

## Show discourse context overlay

This setting controls whether links to discourse nodes carry an inline badge showing how many relations the linked node has.

- When enabled, a badge appears after each link to a discourse node, in both Live Preview and Reading view
- Selecting a badge opens that node's discourse context in a popover, where you can review its relationships and add a new one
- A node with no relations shows a badge reading `0`, and its popover says "No discourse relation found"
- Links to notes that are not discourse nodes never show a badge
- When disabled, the badges are removed immediately; the [discourse context view](/docs/obsidian/core-features/discourse-context) remains available from the sidebar

## Discourse nodes folder path

This setting determines where new discourse nodes will be created in your vault.

- Specify a folder path where you want all new discourse nodes to be stored
- Leave the field empty to create nodes in the root folder of your vault
- You can use the folder suggester to easily navigate and select existing folders
- Example format: `folder1/folder2`

Changes to these settings will only take effect after clicking the "Save Changes" button. The interface will indicate when you have unsaved changes pending.
