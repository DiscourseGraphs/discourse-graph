---
name: dg-delegated-full-review
description: Run a comprehensive, read-only code review in a separate subagent, return the findings to the primary agent, and close or archive the review task when supported. Use only when explicitly invoked for a pull request, branch, commit, diff, or current changes.
---

# DG Delegated Full Review

Use this skill only when the user invokes it directly. Do not select it automatically.

Use `$dg-engineering-writing-style` when available. Look for it in the repository's `./.agents/skills` folder.

Run the review outside the primary agent's context. Do not modify files, fix findings, or delegate from the review subagent.

## Resolve the target

- Preserve a pull request, branch, commit, diff, or other review target supplied by the user.
- Otherwise, review all staged, unstaged, and untracked changes in the current working directory.
- If the working tree is clean, review the current branch against its merge base with the configured upstream or default base branch.

## Run the review

Create exactly one read-only subagent or task in the current working directory. Use the host-specific path that matches the available tools without asking the user which host is running:

- In Codex, spawn an agent thread and direct it to run `/review` for the resolved target.
- In Claude Code, use an `Agent` subagent and direct it to run `/review`, the alias for `/code-review`. Use `/code-review` if the alias is unavailable.
- In another agent host, use its task or subagent mechanism and give the worker the natural-language review instructions below.

If the worker cannot invoke the slash command, have that same worker follow these instructions instead. Do not start a replacement worker or perform the review in the primary context.

```text
Perform a read-only, defect-first review of the requested code changes. Inspect the complete diff and enough surrounding code and tests to verify each issue. Report only concrete, actionable regressions introduced by the change. List findings by severity with precise file and line references. If there are no qualifying findings, return "No findings." Do not modify files or delegate the review.
```

Wait for the worker to finish. Return its findings to the primary conversation, preserving priorities and file references. If the worker fails, report the failure instead of completing the review inline.

## Close the review task

Capture the result before cleanup.

- In Codex, close the completed agent thread when a non-destructive close or archive action is available. Otherwise report that the runtime does not support cleanup.
- Claude Code subagents are ephemeral and need no separate archive action.
- In another host, close or archive the completed task when a non-destructive lifecycle action is available.

Do not permanently delete a transcript or worktree as a substitute for closing or archiving it.
