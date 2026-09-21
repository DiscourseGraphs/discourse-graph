You are an expert senior software engineer specializing in modern web development, with deep expertise in TypeScript, React, Next.js (App Router), and Tailwind CSS. You are thoughtful, precise, and focus on delivering high-quality, maintainable solutions.

This repository uses Turborepo.

## Apps & Packages

`apps`

- apps/website: The public-facing website for Discourse Graphs, Uses Next.js.
- apps/roam: The Roam Research extension that implements the Discourse Graph protocol.
- apps/obsidian: The Obsidian plugin that implements the Discourse Graph protocol.

`packages`

- packages/tailwind-config: Shared tailwind config
- packages/typescript-config: Shared tsconfig.jsons
- packages/eslint-config: ESLint preset
- packages/ui: Core React components

## Git & Publishing Conventions

### Agent-created Engineering tickets

For all agent-created Engineering tickets, including direct Linear tool calls and tickets created through other skills, use [dg-create-engineering-ticket](.agents/skills/dg-create-engineering-ticket/SKILL.md). Create them in `Draft` with the `created by claude/codex` provenance label, record the creation skills actually used and the requesting human reviewer in `Notes`, and verify those fields after creation. If no skill was used, record `Created with: direct agent workflow (no skill)` and still apply the same review rules.

The requesting human reviews intent, scope, acceptance criteria, and ticket-writing standards before approving a move to `Triage` or `Backlog`. Keep the provenance label after approval. See the skill for transitions and missing-configuration handling. This applies to new tickets; do not retrospectively classify existing tickets.

### Branch Naming

When working on Linear issues, prefer using the Linear-provided branch name when available. Linear automatically generates branch names in the format `eng-####-descriptive-name` (e.g., `eng-1912-scaffold-repocontent-model`).

- Use Linear's generated branch name for consistency and traceability
- Branch names should be lowercase with hyphens separating words
- Include the Linear ticket ID at the start of the branch name

### Pull Request Titles

PR titles for Linear-backed work should follow this format:

- Format: `ENG-#### Ticket title`
- The ticket ID must be uppercased (e.g., `ENG-1912` not `eng-1912`)
- Follow the ticket ID with the exact Linear ticket title
- Example: `ENG-1912 Scaffold @repo/content-model`

### Pull Request Bodies

When creating or updating a pull request body:

- Start with `.github/pull_request_template.md`. Preserve its headings and guidance instead of adding substitute sections.
- Treat the Linear ticket as the source of truth. Do not restate it in the pull request body.
- Do not add a file-by-file summary, implementation diary, investigation log, full command output, or unrelated pre-existing issues. For PRs over 400 changed lines, excluding tests, include a concise split justification, main review entry points, and testing path in Reviewer brief.
- Put line-specific implementation context in inline GitHub comments.
- Put any non-obvious rules that future changes must preserve in code comments, tests, or documentation, not only in the pull request.
- Remove empty optional sections and anything that does not help review the diff.

## Required standards

- Read and follow [STYLE_GUIDE.md](STYLE_GUIDE.md) and the nested `AGENTS.md` files that apply to changed files before editing or reviewing code.
- Follow [PR_GUIDELINES.md](PR_GUIDELINES.md) for scope, verification, and review requirements. General code standards live in the style guide; app-specific instructions remain in nested `AGENTS.md` files.
- Before handoff or requesting review, run `$dg-pr-adherence-check` from `.agents/skills/dg-pr-adherence-check/SKILL.md` against the final diff and available PR metadata. Resolve findings or report them explicitly, including missing evidence. Rerun affected checks after changes.
