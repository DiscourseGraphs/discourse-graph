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

## When to Run

On demand. Two modes:

- **Current branch** — Run while on a feature branch that's ready for PR or review.
- **Merged PR** — Pass a PR number to generate docs for an already-merged PR that's missing documentation.

## Step 1: Gather Context

### If running for the current branch

Collect information from three sources:

1. **Changed files** — Run `git diff main...HEAD --name-only` to identify what changed. Use file paths to determine the affected platform (see [scope-detection.md](references/scope-detection.md) for mapping).
2. **Commit messages** — Run `git log main...HEAD --oneline` for a summary of what was done.
3. **Linear ticket** — If a Linear ticket is linked (branch name or PR description), pull the title, description, and acceptance criteria for additional context. Use Linear MCP if available. If it's not available, prompt the dev to install Linear MCP using these instructions: https://linear.app/docs/mcp

### If running for a merged PR

Use the PR number to gather context via `gh`:

1. **PR details** — Run `gh pr view <PR_NUMBER>` to get the title, description, and linked issues.
2. **Changed files** — Run `gh pr diff <PR_NUMBER> --name-only` to identify what changed. Use file paths to determine the affected platform.
3. **Linear ticket** — If a Linear ticket is referenced in the PR title, branch name, or description, pull additional context from it.

## Step 2: Determine If Docs Are Needed

Apply the scope detection heuristic. See [scope-detection.md](references/scope-detection.md) for the full yes/no lists and file path → platform mapping.

If no docs update is needed, inform the dev and stop.

## Step 3: New Page vs Update Existing

1. Search existing documentation for content related to the change. See [doc-conventions.md](references/doc-conventions.md) for file locations.
2. **Ask the dev:** "I found these existing pages that might be related: [list]. Should I update one of these, or create a new page?"
3. Defaults:
   - Completely new feature with no existing coverage → new page
   - Extending or modifying an already-documented feature → update existing page

## Step 4: Write or Update the Doc

Follow the formatting rules in [doc-conventions.md](references/doc-conventions.md) (frontmatter, filenames, screenshot placeholders, cross-link integrity, side observations).

If a **new page** is created, register it in navigation. See [navigation-mapping.md](references/navigation-mapping.md) for `docMap.ts` and `navigation.ts` patterns and examples.

## Step 5: Verification

1. Present the draft changes to the dev for review.
2. List any screenshot placeholders that need filling.
3. Flag any broken cross-links or stale content observed.
4. **Leave all changes as unstaged modifications** — do not commit. The dev reviews and commits themselves.
