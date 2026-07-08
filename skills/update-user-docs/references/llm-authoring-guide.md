# LLM Authoring Guide

Use this guide when asking an LLM to write or update Discourse Graphs docs.

## Copy/paste prompt

```text
Write or update Discourse Graphs user docs in the live Nextra content tree only.

Use these paths:
- Obsidian docs: apps/website/content/obsidian/**
- Roam docs: apps/website/content/roam/**
- Sidebar order: nearest _meta.ts file
- Flat legacy redirects: apps/website/docsRouteMap.ts

Do not edit route shells or legacy docs paths. Do not use app/(docs)/docs/*/pages, docMap.ts, navigation.ts, or sharedPages.

If adding a page, choose the right platform section, create a kebab-case .md or .mdx file, update the nearest _meta.ts, and update docsRouteMap.ts only when a flat /docs/<platform>/<slug> redirect should exist.

For screenshots, use real files in apps/website/public/docs/<platform>/ when available. If screenshots are missing, add an HTML TODO comment and list the needed screenshots in your summary. Do not add broken placeholder images.

Before finishing, verify links, sidebar registration, route redirects, and stale legacy path references.
```

## Correct path examples

- Existing Obsidian page: `apps/website/content/obsidian/core-features/creating-discourse-nodes.md`
- New Obsidian page: `apps/website/content/obsidian/core-features/my-new-feature.md`
- Existing Roam page: `apps/website/content/roam/guides/querying-discourse-graph.md`
- Nested Roam section: `apps/website/content/roam/guides/exploring-discourse-graph/discourse-context.md`
- Sidebar metadata: `apps/website/content/obsidian/core-features/_meta.ts`
- Redirect map: `apps/website/docsRouteMap.ts`
- Screenshots: `apps/website/public/docs/obsidian/my-screenshot.png`

## Updating an existing page

1. Search `apps/website/content/**` for the feature, setting, command, or workflow.
2. Edit the closest existing platform page.
3. Preserve frontmatter and the page's current tone.
4. Verify every new link points to a live docs route or existing file.
5. Mention any screenshot TODOs or unrelated stale content in the final summary.

## Adding a new page

1. Pick the platform: `obsidian` or `roam`.
2. Pick the section that matches the user's workflow.
3. Create a kebab-case `.md` or `.mdx` file.
4. Add frontmatter with title, date, author, and published fields.
5. Add the slug to the nearest `_meta.ts` file.
6. Update `apps/website/docsRouteMap.ts` only if a flat legacy route should redirect to the sectioned route.

## Screenshot handling

Use screenshots only when the file exists or the dev provides it.
If the screenshot is not available yet, add a comment like:

```markdown
<!-- TODO: Add screenshot of the node type picker in Obsidian. -->

![Screenshot placeholder](/docs/obsidian/example-screenshot.png)
```

## Final review checklist

- Docs edits are under `apps/website/content/**`.
- New pages are registered in the nearest `_meta.ts`.
- Needed flat redirects are in `apps/website/docsRouteMap.ts`.
- New links resolve to existing routes or files.
- Screenshot TODOs are comments, not broken images.
- No positive instructions point to legacy docs paths.

Legacy warning: route shells and deleted legacy docs paths such as `app/(docs)/docs/*/pages`, `docMap.ts`, `navigation.ts`, and `sharedPages` are not docs authoring targets.
