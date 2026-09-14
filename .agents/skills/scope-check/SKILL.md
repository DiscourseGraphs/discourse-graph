---
name: scope-check
description: Compare a pull request or Git diff with a Linear engineering ticket's Done When criteria and produce a copy-ready PR scope check. Use when preparing or reviewing a PR, checking whether an implementation introduced broader abstractions or unsupported cases, or documenting why added scope is required now.
---

# Scope Check

Compare the completed change with its acceptance boundary. Return a copy-ready `Scope check` section unless the user requests the analysis too.

## Gather the Inputs

1. Resolve the Linear issue from an explicit `ENG-###` identifier, then from the PR or branch name. Fetch the issue with the Linear connector. If it is unavailable, ask for the ticket's `Problem`, `Solution`, and `Done When` sections.
2. Treat `Done When` as the acceptance boundary. Use `Problem` and `Solution` only to clarify that boundary, not to silently expand it.
3. Resolve the final change set from the supplied diff or PR. For a PR, inspect its metadata and complete diff. For the current branch, compare it with the PR base branch and include staged and unstaged changes.
4. Read linked decisions or ticket comments only when they explain an apparent scope expansion.

## Evaluate Scope

Map every material behavior or architectural change to a `Done When` criterion.

- Treat implementation details, tests, documentation, and generated files required to satisfy `Done When` as in scope.
- Flag broader abstractions, unrelated refactors, new dependencies, migrations, or support for cases not required by `Done When`.
- Do not treat a change as in scope only because it is useful or adjacent.

For each scope expansion, determine:

1. What broader abstraction or additional case was introduced?
2. Which current use case or ticket requires it, and why must it be included now rather than deferred?
3. Was anyone affected or consulted, and where is the discussion or decision recorded?

Do not invent missing justification. Mark it `Not documented` and recommend recording it in a Linear comment before the PR is merged.

## Format the Result

Use this form when the diff stays within scope:

```markdown
## Scope check

- [x] Ran `$scope-check` against ENG-#### and the final diff.
- Scope beyond `Done When`: None.
```

Use this form when the diff expands scope:

```markdown
## Scope check

- [x] Ran `$scope-check` against ENG-#### and the final diff.
- Scope beyond `Done When`: <what changed>
- Required now: <use case or ticket and why it cannot be deferred>
- Anyone affected or consulted: <Yes, No, or Not documented>
- Decision: <link to the discussion or decision, or `Not documented`>
```

If the ticket or diff cannot be resolved, leave the checkbox unchecked and state exactly what input is missing. Keep findings short and evidence-based.

Do not modify the issue, PR, or implementation unless the user explicitly asks.
