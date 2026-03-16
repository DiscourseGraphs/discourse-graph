# Documentation Conventions

## File Locations

Platform-specific docs live in their respective directories:

- **Obsidian:** `apps/website/app/(docs)/docs/obsidian/pages/`
- **Roam:** `apps/website/app/(docs)/docs/roam/pages/`
- **Shared (cross-platform):** `apps/website/app/(docs)/docs/sharedPages/`

Only place docs in `sharedPages/` if the content applies identically to both platforms and is explicitly specified as shared.

## Filename Convention

Use **kebab-case** for all doc filenames (e.g., `creating-discourse-nodes.md`).

## Frontmatter

Every doc file **must** include this frontmatter block:

```yaml
---
title: "Page Title"
date: "YYYY-MM-DD"
author: ""
published: true
---
```

## Screenshot Placeholders

For UI changes or new features with visual elements, insert a placeholder:

```markdown
<!-- TODO: Add screenshot of [describe the UI element or feature] -->

![Screenshot placeholder](placeholder)
```

Always inform the dev that there are screenshot placeholders to fill in.

## Cross-Link Integrity

- When adding or updating cross-links (e.g., `[text](./other-page)`), verify that the target page exists.
- If a link target does not exist, flag it to the dev.

## Side Observations

If while editing an existing doc you notice stale or incorrect content unrelated to the current change, flag it as a side observation to the dev. Do not silently fix unrelated content.
