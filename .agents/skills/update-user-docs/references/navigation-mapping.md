# Navigation Mapping

The live docs use Nextra content files under `apps/website/content/**`.
Sidebar structure comes from `_meta.ts` files placed next to the Markdown and MDX files they describe.

## Content locations

- Obsidian docs: `apps/website/content/obsidian/**`
- Roam docs: `apps/website/content/roam/**`
- Shared top-level docs: `apps/website/content/**` only when the page is intentionally site-wide, not plugin-specific

## Sidebar registration with `_meta.ts`

Each directory can include a `_meta.ts` file that controls page titles, section labels, order, and hidden index pages.

Top-level example:

```ts
import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  index: {
    title: "Overview",
    display: "hidden",
  },
  welcome: "Welcome",
  "core-features": "Core features",
  "use-cases": "Use cases",
};

export default meta;
```

Section example:

```ts
import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  "creating-discourse-nodes": "Creating nodes",
  "creating-discourse-relationships": "Creating relationships",
  "querying-discourse-graph": "Querying",
};

export default meta;
```

When adding a new page:

1. Add the `.md` or `.mdx` file in the correct section directory.
2. Add the file slug to that directory's `_meta.ts`.
3. Add parent section entries in parent `_meta.ts` files only if you created a new directory.
4. Keep titles short enough for the sidebar.

## Redirects with `docsRouteMap.ts`

The docs now use sectioned routes such as `/docs/obsidian/core-features/creating-discourse-nodes`.
Some older flat routes, such as `/docs/obsidian/creating-discourse-nodes`, are preserved by redirects in `apps/website/docsRouteMap.ts`.

Update `docsRouteMap.ts` when:

- You add a new page that should keep or introduce a flat `/docs/<platform>/<slug>` redirect.
- You move an existing page to a different section and need its old URL to resolve.
- You add a nested page whose old URL had a custom location.

Do not update `docsRouteMap.ts` when:

- You only edit existing page content.
- The new page does not need a legacy flat URL.
- The route is already covered by the platform section maps or custom redirects.

For most new pages, add the slug under the correct platform section map:

```ts
export const OBSIDIAN_DOC_SECTIONS = {
  "core-features": ["creating-discourse-nodes", "new-page-slug"],
} as const;
```

Use `createRedirect` for custom or nested redirects that cannot be represented by the section maps.

## Legacy warning

Do not use the deleted legacy docs mapping files: `docMap.ts`, `navigation.ts`, or `sharedPages`.
They are no longer the source of truth for docs navigation.
