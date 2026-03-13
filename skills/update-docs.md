# Update Docs

Auto-update user-facing documentation when a feature or behavior change ships.

## When to Run

On demand. Two modes:

- **Current branch** — Run while on a feature branch that's ready for PR or review.
- **Merged PR** — Pass a PR number to generate docs for an already-merged PR that's missing documentation.

## Step 1: Gather Context

### If running for the current branch

Collect information from three sources:

1. **Changed files** — Run `git diff main...HEAD --name-only` to identify what changed. Use file paths to determine the affected platform:
   - `apps/obsidian/` → Obsidian docs
   - `apps/roam/` → Roam docs
   - `packages/` → Ask the dev which platform(s) are affected
2. **Commit messages** — Run `git log main...HEAD --oneline` for a summary of what was done.
3. **Linear ticket** — If a Linear ticket is linked (branch name or PR description), pull the title, description, and acceptance criteria for additional context.

### If running for a merged PR

Use the PR number to gather context via `gh`:

1. **PR details** — Run `gh pr view <PR_NUMBER>` to get the title, description, and linked issues.
2. **Changed files** — Run `gh pr diff <PR_NUMBER> --name-only` to identify what changed. Use file paths to determine the affected platform.
3. **Linear ticket** — If a Linear ticket is referenced in the PR title, branch name, or description, pull additional context from it.

## Step 2: Determine If Docs Are Needed

Apply the heuristic: **"Would a user notice this change?"**

**Update docs for:**

- New user-facing feature
- Changed behavior of an existing feature
- Removed feature
- New, changed, or removed settings/configuration
- Changed setup or prerequisites
- Deprecation of a feature (add a warning note, don't remove content)

**Do NOT update docs for:**

- Internal refactor with no user-visible change
- Bug fix that restores already-documented behavior
- Test-only changes
- Dev tooling changes (CI, linting, build config)
- Performance optimization with no user-facing behavior change

If no docs update is needed, inform the dev and stop.

## Step 3: New Page vs Update Existing

1. Search existing documentation for content related to the change:
   - Obsidian docs: `apps/website/app/(docs)/docs/obsidian/pages/`
   - Roam docs: `apps/website/app/(docs)/docs/roam/pages/`
   - Shared docs: `apps/website/app/(docs)/docs/sharedPages/`
2. **Ask the dev:** "I found these existing pages that might be related: [list]. Should I update one of these, or create a new page?"
3. Defaults:
   - Completely new feature with no existing coverage → new page
   - Extending or modifying an already-documented feature → update existing page

## Step 4: Write or Update the Doc

### Conventions

- **Filenames:** kebab-case (e.g., `creating-discourse-nodes.md`)
- **Frontmatter:** All doc files must include:
  ```yaml
  ---
  title: "Page Title"
  date: "YYYY-MM-DD"
  author: ""
  published: true
  ---
  ```
- **Platform routing:** Docs are platform-specific by default. Only place docs in `sharedPages/` if explicitly specified.

### Navigation Mapping

If a **new page** is created, register it in the appropriate `docMap.ts` and `navigation.ts`:

**docMap.ts** (maps slugs to content directories — only needed for shared pages; platform-specific pages use the default):

- Obsidian: `apps/website/app/(docs)/docs/obsidian/docMap.ts`
- Roam: `apps/website/app/(docs)/docs/roam/docMap.ts`
- Shared: `apps/website/app/(docs)/docs/shared/docMap.ts`

**navigation.ts** (controls sidebar — must be updated for every new page):

- Obsidian: `apps/website/app/(docs)/docs/obsidian/navigation.ts`
- Roam: `apps/website/app/(docs)/docs/roam/navigation.ts`

Add the page to the appropriate section in the navigation array so it appears in the sidebar.

### Screenshot Placeholders

For UI changes or new features with visual elements, insert a placeholder:

```markdown
<!-- TODO: Add screenshot of [describe the UI element or feature] -->
![Screenshot placeholder](placeholder)
```

Inform the dev that there are screenshot placeholders to fill in.

### Cross-Link Integrity

- When adding or updating cross-links (e.g., `[text](./other-page)`), verify that the target page exists.
- If a link target does not exist, flag it to the dev.

### Side Observations

If while editing an existing doc you notice stale or incorrect content unrelated to the current change, flag it as a side observation to the dev. Do not silently fix unrelated content.

## Step 5: Verification

1. Present the draft changes to the dev for review.
2. List any screenshot placeholders that need filling.
3. Flag any broken cross-links or stale content observed.
4. **Leave all changes as unstaged modifications** — do not commit. The dev reviews and commits themselves.
