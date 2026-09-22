---
name: update-user-docs
description: Auto-update user-facing documentation when a feature or behavior change ships. Run when dev invokes manually so they can add the doc to a PR ready-for-review. Optionally pass a PR number for an already-merged PR.
metadata:
  argument-hint: "[PR number]"
---

# Update Docs

Auto-update user-facing documentation when a feature or behavior change ships.
If `$ARGUMENTS` is provided, treat it as a GitHub PR number. Use `gh pr view $ARGUMENTS` to get the PR diff, changed files, and description. Use this instead of the current branch context.

If no argument is provided, use the current branch's diff against main, commit messages, and any linked Linear ticket to determine what changed.

## Guardrails

- Edit live docs only under `apps/website/content/**`.
- Put Obsidian docs under `apps/website/content/obsidian/**`.
- Put Roam docs under `apps/website/content/roam/**`.
- Do not edit legacy docs route shells or deleted legacy docs paths such as `apps/website/app/(docs)/docs/*/pages`, `docMap.ts`, `navigation.ts`, or `sharedPages`.
- Do not update runtime code, app routes, or package interfaces unless the dev explicitly asks for that separately.
- Use existing Nextra Markdown, MDX, and `nextra/components` features before proposing custom styling or layout.
- Use the existing global `NodeTag` MDX component for discourse candidate tag pills, such as `<NodeTag type="clm" />`. Allowed `type` values are `que`, `clm`, `evd`, `src`, `hyp`, `res`, and `iss`. Do not create one-off tag styling or CSS in docs content.
- Do not add or change theme, layout, route, component, or CSS code while adding documentation content. If existing Nextra features are not enough, flag the author to create a separate Linear ticket for new Nextra functionality.

## When to Run

On demand. Two modes:

- **Current branch** - Run while on a feature branch that's ready for PR or review.
- **Merged PR** - Pass a PR number to generate docs for an already-merged PR that's missing documentation.

## Step 1: Gather Context

### If running for the current branch

Collect information from three sources:

1. **Changed files** - Run `git diff main...HEAD --name-only` to identify what changed. Use file paths to determine the affected platform (see [scope-detection.md](references/scope-detection.md) for mapping).
2. **Commit messages** - Run `git log main...HEAD --oneline` for a summary of what was done.
3. **Linear ticket** - If a Linear ticket is linked by branch name or PR description, pull the title, description, and acceptance criteria for additional context. Use the Linear connector if available. If it is not available, prompt the dev to install Linear MCP using these instructions: https://linear.app/docs/mcp

### If running for a merged PR

Use the PR number to gather context via `gh`:

1. **PR details** - Run `gh pr view <PR_NUMBER>` to get the title, description, and linked issues.
2. **Changed files** - Run `gh pr diff <PR_NUMBER> --name-only` to identify what changed. Use file paths to determine the affected platform.
3. **Linear ticket** - If a Linear ticket is referenced in the PR title, branch name, or description, pull additional context from it.

## Step 2: Determine If Docs Are Needed

Apply the scope detection heuristic. See [scope-detection.md](references/scope-detection.md) for the full yes/no lists and file path to platform mapping.

If no docs update is needed, inform the dev and stop.

## Step 3: New Page vs Update Existing

1. Search existing docs only under `apps/website/content/**`.
2. Prefer updating an existing page when the change extends or corrects an already-documented feature.
3. Create a new page when the feature or workflow has no natural existing home.
4. If multiple plausible homes exist, ask the dev which page or section should own the content.

Defaults:

- Completely new feature with no existing coverage -> new page.
- Extending or modifying an already-documented feature -> update the existing page.
- Change applies to both platforms -> update both platform docs unless the existing docs already share a conceptual page through both sidebars.

## Step 4: Write or Update the Doc

Follow the formatting rules in [doc-conventions.md](references/doc-conventions.md).

For an **existing page**:

1. Edit the Markdown or MDX file under the relevant `apps/website/content/**` path.
2. Preserve existing frontmatter and local style.
3. Verify any new links point to live docs routes or existing files.

For a **new page**:

1. Choose the correct platform and section directory, such as `apps/website/content/obsidian/core-features/` or `apps/website/content/roam/guides/`.
2. Add a kebab-case `.md` or `.mdx` file with frontmatter.
3. Add the page slug to the nearest `_meta.ts` file so it appears in the sidebar. See [navigation-mapping.md](references/navigation-mapping.md).
4. Update `apps/website/docsRouteMap.ts` only when a flat legacy redirect like `/docs/<platform>/<slug>` should continue to resolve to the new sectioned route.

## Step 5: Verification

1. Present the draft changes to the dev for review.
2. List any screenshots that still need to be captured.
3. Flag broken cross-links, missing route map redirects, or stale content observed while editing.
4. Leave all changes as unstaged modifications. The dev reviews and commits themselves.
