---
name: update-docs
description: Auto-update user-facing documentation when a feature or behavior change ships. Run after a feature branch is ready for PR or review. Optionally pass a PR number for an already-merged PR.
argument-hint: "[PR number]"
---

Follow the steps in `skills/update-docs.md` to update documentation.

If `$ARGUMENTS` is provided, treat it as a GitHub PR number. Use `gh pr view $ARGUMENTS` to get the PR diff, changed files, and description. Use this instead of the current branch context.

If no argument is provided, use the current branch's diff against main, commit messages, and any linked Linear ticket to determine what changed.
