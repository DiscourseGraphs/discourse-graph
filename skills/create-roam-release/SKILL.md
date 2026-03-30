---
name: create-roam-release
description: Create a release for the Discourse Graphs Roam plugin. Use when the user wants to draft or publish a Roam release, generate or update the Roam changelog from Linear issues, trigger the Roam Depot release workflow, or mark merged Roam issues as released.
---

Create a release for the Discourse Graphs Roam plugin with version `$ARGUMENTS`.

Follow these steps:

## 1. Validate input

- The argument must be a semver version (for example `0.18.0`). If it is missing or invalid, ask the user.
- Read `apps/roam/package.json` and confirm the requested version matches the current package version.
- Read `apps/roam/CHANGELOG.md` and detect whether that version already has an entry.
- If the version does not match `package.json`, stop and ask the user to resolve the mismatch before continuing.

## 2. Gather Roam release candidates from Linear

Use Linear as the source of truth. The relevant workflow states are `Merged` and `Released`.

### Primary candidates

- Query Engineering issues in the Linear project `Roam Discourse Graph plugin assorted tasks` with state `Merged`.
- These are the default included issues.

### Spillover candidates

- Query Engineering issues with label `Roam plugin` and state `Merged`.
- Remove any issue already captured in the primary set.
- Remove obvious release-ticket items, such as titles like:
  - `Release Roam ...`
  - `Roam Release ...`
  - `release to Roam Depot ...`
- These issues are not auto-included. Present them separately for explicit user approval.

### Exclusions

- Do not include any issue already in state `Released`.
- Keep `Chore`, `Documentation`, telemetry-only, build-only, deploy-only, and release-process-only work in a separate review-only excluded list unless the user explicitly asks to include an item.

## 3. Classify the included issues

Build the final changelog from user-facing changes only.

- `Bug` -> `Fixed`
- Clear new functionality or `Feature` -> `Added`
- User-facing improvements, UX refinements, behavior changes, and meaningful performance work -> `Changed`
- Internal-only work -> exclude from the final changelog by default

When labels are incomplete, use the title and description to infer the best category. Prefer concise user-facing wording over reproducing Linear titles verbatim.

## 4. Show the review set before editing files

Before mutating anything, show the user:

- Included primary issues
- Spillover issues that need approval
- Excluded internal-only issues
- A draft changelog entry

Ask the user to confirm:

- Which spillover issues to include
- Any wording or categorization changes
- Whether to proceed with updating `apps/roam/CHANGELOG.md`

## 5. Generate the changelog entry

Follow the existing Roam changelog style in `apps/roam/CHANGELOG.md`.

Format:

```md
## [0.18.0] - 2026-03-29

### Added

- **Short label** - user-facing description

### Changed

- **Short label** - user-facing description

### Fixed

- **Short label** - user-facing description
```

Rules:

- Omit empty sections.
- Keep entries short and user-facing.
- Prefer bold lead phrases when they help scanning.
- If the target version already has an entry, update that entry instead of creating a duplicate.
- Otherwise prepend the new entry immediately below the changelog header text.

## 6. Edit the changelog

- Update `apps/roam/CHANGELOG.md` only after the user approves the draft.
- After editing, show the final entry back to the user and ask for one more confirmation before publishing.

## 7. Publish the Roam release

Treat the GitHub Actions workflow as the authoritative publish step.

- Trigger the existing workflow:

```bash
gh workflow run roam-release.yaml --repo DiscourseGraphs/discourse-graph
```

- Then inspect the newest run for that workflow and wait for completion.
- If the workflow cannot be triggered from the current environment, stop after the changelog update and give the user the exact next manual step instead of switching to a different publish path.
- Do not fall back to a different release mechanism unless the user explicitly asks for it.

## 8. Mark included issues as sent to Roam for review in Linear

Only after the Roam publish workflow succeeds:

- Move every included issue from `Merged` to `Sent to Roam for Review`.
- Do not create or update a separate Linear release ticket.
- Do not change spillover issues the user did not approve.

If publish fails or is skipped, do not move any issues to `Sent to Roam for Review`.

## 9. Final response

Report:

- The final changelog entry
- Which issues were included
- Which spillover issues were added or skipped
- Whether the GitHub Actions release workflow was triggered successfully
- Which Linear issues were moved to `Sent to Roam for Review`

If publish did not happen, clearly state that the changelog was prepared but Linear release bookkeeping was not applied.
