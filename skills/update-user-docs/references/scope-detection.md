# Scope Detection

## Heuristic: "Would a user notice this change?"

Use this question to determine whether a code change requires a documentation update.

## Update docs for

- New user-facing feature
- Changed behavior of an existing feature
- Removed feature
- New, changed, or removed settings/configuration
- Changed setup or prerequisites
- Deprecation of a feature (add a warning note, don't remove content)

## Do NOT update docs for

- Internal refactor with no user-visible change
- Bug fix that restores already-documented behavior
- Test-only changes
- Dev tooling changes (CI, linting, build config)
- Performance optimization with no user-facing behavior change

If no docs update is needed, inform the dev and stop.

## File Path to Platform Mapping

Use changed file paths to determine which platform's docs are affected:

| File path pattern | Platform | Doc directory                                                   |
| ----------------- | -------- | --------------------------------------------------------------- |
| `apps/obsidian/`  | Obsidian | `apps/website/app/(docs)/docs/obsidian/pages/`                  |
| `apps/roam/`      | Roam     | `apps/website/app/(docs)/docs/roam/pages/`                      |
| `packages/`       | Ask dev  | Could affect either or both platforms                           |
| `apps/website/`   | Website  | Usually not user-facing docs (unless it's the docs site itself) |
