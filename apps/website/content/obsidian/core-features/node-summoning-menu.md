---
title: "Node summoning menu"
date: "2026-11-15"
author: ""
published: true
---

The **node summoning menu** lets you link to a discourse node without leaving the note you're writing. Type `@`, start typing a title, and pick the node from a list grouped by node type.

![Node summoning menu with results grouped by node type](/docs/obsidian/node-summoning-menu.png)

## Open the menu

Type `@` at the start of a line or after a space. The menu opens at your cursor. Keep typing to narrow the results by title.

- An `@` inside a word, such as `me@lab.org`, doesn't open the menu.
- The menu doesn't open inside code, frontmatter, links, math or comments.
- A space right after `@` closes the menu, so `@ the lab` stays plain text.

### Change the trigger

To use something other than `@`, open **Settings → Discourse Graph → General** and edit **Node search trigger**. The trigger can be up to 5 characters. It can't contain spaces or the node tag hotkey (`\` by default). Leave it empty to turn the menu off.

## Insert a link

Results are grouped by node type, in the order your node types are configured, with up to 10 nodes per type. Within a group, the closest title matches come first. Before you type a query, each group lists its nodes alphabetically.

Click a result, or highlight it and press `↵`, to replace what you typed with a link to that node. The link uses the format set in Obsidian's **Files and links** settings.

| Action                      | Shortcut  |
| --------------------------- | --------- |
| Move the highlight          | `↑` / `↓` |
| Insert the highlighted node | `↵`       |
| Close the menu              | `Esc`     |

If nothing matches, the menu shows "No matching nodes", and `↵` closes it.

## Filter by node type

Click the funnel icon at the top of the menu. The type filter opens inside the menu, above the results, and your cursor stays in the note so you can keep typing.

![Type filter open inside the node summoning menu, with Question unchecked](/docs/obsidian/node-summoning-menu-type-filter.png)

- **Uncheck a type** to remove its group from the results. Unchecking the last checked type brings every group back.
- **Only** appears when you hover a row. It narrows the filter to that type and closes the filter.
- **Clear filter (N)** appears while a filter is active, where N is the number of types selected. It checks every type again.

The funnel icon is highlighted while the filter is open or active. Unchecking every type is the same as checking every type: both show all your nodes. The filter resets to all types each time the menu opens.

[Node search](/docs/obsidian/core-features/node-search) uses the same type filter, plus a search box for long lists of node types.
