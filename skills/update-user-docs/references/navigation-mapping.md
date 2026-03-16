# Navigation Mapping

When a **new page** is created, it must be registered in two places: `docMap.ts` (for shared pages) and `navigation.ts` (for all new pages).

## docMap.ts — Slug-to-directory mapping

Maps page slugs to their content directories. Platform-specific pages use the `default` path automatically, so you only need to add entries here for **shared pages**.

### File locations

- Obsidian: `apps/website/app/(docs)/docs/obsidian/docMap.ts`
- Roam: `apps/website/app/(docs)/docs/roam/docMap.ts`
- Shared: `apps/website/app/(docs)/docs/shared/docMap.ts`

### How it works

Each platform's `docMap.ts` spreads in `sharedDocMap` from the shared module. Platform-specific pages resolve via the `default` key.

**Obsidian example:**

```ts
import { DocMapType, sharedDocMap } from "~/(docs)/docs/shared/docMap";

const OBSIDIAN_DOCS = "app/(docs)/docs/obsidian/pages";

export const docMap: DocMapType = {
  default: OBSIDIAN_DOCS,
  ...sharedDocMap,
};
```

**Shared docMap (`apps/website/app/(docs)/docs/shared/docMap.ts`):**

```ts
export const SHARED_DOCS = "app/(docs)/docs/sharedPages";

export const sharedDocMap = {
  "what-is-a-discourse-graph": SHARED_DOCS,
  "base-grammar": SHARED_DOCS,
  "literature-reviewing": SHARED_DOCS,
  "research-roadmapping": SHARED_DOCS,
  "reading-clubs": SHARED_DOCS,
  "lab-notebooks": SHARED_DOCS,
} as const;
```

**When to update:** Only when adding a shared page. Add the slug → `SHARED_DOCS` mapping in `sharedDocMap`.

## navigation.ts — Sidebar navigation

Controls what appears in the docs sidebar. **Must be updated for every new page.**

### File locations

- Obsidian: `apps/website/app/(docs)/docs/obsidian/navigation.ts`
- Roam: `apps/website/app/(docs)/docs/roam/navigation.ts`

### Structure

Navigation is an array of sections, each with a title and links:

```ts
import { NavigationList } from "~/components/Navigation";

const ROOT = "/docs/obsidian";

export const navigation: NavigationList = [
  {
    title: "🏠 Getting started",
    links: [
      { title: "Getting started", href: `${ROOT}/getting-started` },
      { title: "Installation", href: `${ROOT}/installation` },
    ],
  },
  {
    title: "⚙️ Configuration",
    links: [
      { title: "Node types & templates", href: `${ROOT}/node-types-templates` },
      { title: "Relationship types", href: `${ROOT}/relationship-types` },
    ],
  },
  // ...more sections
];
```

**To add a new page:** Insert a `{ title: "Page Title", href: \`${ROOT}/slug\` }` entry in the appropriate section's `links` array.
