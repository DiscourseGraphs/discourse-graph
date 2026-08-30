# Documentation Conventions

## File locations

User-facing plugin docs live in the Nextra content tree:

- Obsidian: `apps/website/content/obsidian/**`
- Roam: `apps/website/content/roam/**`
- Blog posts: `apps/website/content/blog/**`
- Site-wide docs landing pages: `apps/website/content/**`

Do not create plugin docs outside `apps/website/content/**`.

## Filename convention

Use kebab-case for doc filenames, such as `creating-discourse-nodes.md`.
Use `.md` for normal prose pages and `.mdx` only when the page needs components.

## Frontmatter

Every plugin doc file should include this frontmatter block unless nearby files in the same section use a different required shape:

```yaml
---
title: "Page title"
date: "YYYY-MM-DD"
author: ""
published: true
---
```

Use sentence case for page titles unless the title includes an official product name, plugin name, or UI label.

## Nextra styling and formats

Use existing Nextra Markdown, MDX, and `nextra/components` features before proposing custom styling.

Good first choices include:

- Standard Markdown headings, lists, links, tables, and code fences
- Nextra `Callout` for warnings, tips, notes, and important context
- Nextra `Cards` for small sets of high-level navigation options
- Nextra `Steps` for ordered setup or workflow instructions
- Nextra `Tabs` for compact platform or mode variants
- Nextra `Table` and `FileTree` when structured data or file paths need clearer presentation
- The global `NodeTag` MDX component for discourse candidate tag pills, such as `<NodeTag type="clm" />`, `<NodeTag type="evd" />`, or `<NodeTag type="que" />`. Allowed `type` values are `que`, `clm`, `evd`, `src`, `hyp`, `res`, and `iss`.

Use `.mdx` when a page needs MDX components like `Callout`, `Image`, or `NodeTag`. `NodeTag` renders `#<type>-candidate` by default and uses the approved node colors. Do not import `NodeTag` in individual docs pages; it is registered globally through `mdx-components.tsx`.

Do not change docs structural code, theme files, route shells, app layouts, shared components, or CSS as part of adding content.
If the content needs a styling or presentation feature that existing Nextra features cannot support, stop and flag the author to create a separate Linear ticket for adding that Nextra functionality.

## Links

- Prefer absolute docs routes for cross-page links, such as `/docs/obsidian/core-features/node-tags`.
- Use relative links only when the target is in the same local section and the existing section already uses relative links.
- Verify every new link points to an existing file or route.
- Do not link to old flat routes when the current sectioned route is known.

## Screenshots and media

Place documentation images in `apps/website/public/docs/<platform>/`.

Use public paths in Markdown:

```markdown
<!-- TODO: Add screenshot of [describe the UI element or feature] -->
<!-- ![Screenshot placeholder](/docs/roam/my-image.png) -->
```

For UI changes or visual features:

- Use a real screenshot when one is available.
- If no screenshot is available, add an HTML TODO comment describing what should be captured.
- Tell the dev exactly which screenshots still need to be captured.

## Cross-link integrity

- When adding or updating cross-links (e.g., `[text](./other-page)`), verify that the target page exists.
- If a link target does not exist, flag it to the dev.

## Cross-platform content

If a change applies to both Obsidian and Roam, update both platform docs unless there is already a shared conceptual page surfaced from both sidebars.
Keep platform-specific commands, settings names, and screenshots in the relevant platform section.

## Side observations

If you notice stale or incorrect content unrelated to the current change, flag it as a side observation.
Do not silently fix unrelated docs content unless the dev asks you to broaden the scope.
