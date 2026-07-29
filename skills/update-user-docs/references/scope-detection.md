# Scope Detection

## Heuristic: would a user notice this change?

Use this question to determine whether a code change requires a documentation update.

## Update docs for

- New user-facing feature
- Changed behavior of an existing feature
- Removed feature
- New, changed, or removed settings or configuration
- Changed setup, installation, permissions, or prerequisites
- Deprecation of a feature, which should be documented with a warning note

## Do not update docs for

- Internal refactor with no user-visible change
- Bug fix that restores already-documented behavior
- Test-only changes
- Dev tooling changes, CI, linting, or build config
- Performance optimization with no user-facing behavior change

If no docs update is needed, inform the dev and stop.

If a docs content request requires new styling, layout, component, theme, route, or CSS behavior that existing Nextra features cannot provide, do not fold that work into the docs content update. Flag it as a separate Linear ticket for adding new Nextra functionality.

## File path to docs scope mapping

| Changed file path pattern          | Docs scope                | Target docs location                                                                   |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `apps/obsidian/**`                 | Obsidian                  | `apps/website/content/obsidian/**`                                                     |
| `apps/roam/**`                     | Roam                      | `apps/website/content/roam/**`                                                         |
| `apps/website/content/obsidian/**` | Obsidian docs site        | `apps/website/content/obsidian/**`                                                     |
| `apps/website/content/roam/**`     | Roam docs site            | `apps/website/content/roam/**`                                                         |
| `apps/website/content/blog/**`     | Blog                      | `apps/website/content/blog/**`                                                         |
| `apps/website/docsRouteMap.ts`     | Docs redirects            | Usually no prose docs update unless a route move needs explanation                     |
| `packages/content-model/**`        | Both platforms            | Check whether both plugin docs need the same conceptual update                         |
| `packages/database/**`             | Both platforms or website | Ask whether the change affects plugin users, website users, or internal APIs           |
| `packages/ui/**`                   | Docs site or product UI   | Update docs only if user-facing docs behavior changed                                  |
| `packages/**`                      | Ask dev                   | Could affect Obsidian, Roam, both platforms, or internal code only                     |
| `apps/website/app/**`              | Website or docs site      | Update prose docs only if public docs behavior or user-facing website behavior changed |
| `skills/update-user-docs/**`       | Docs authoring guidance   | Update this skill's references, not live product docs                                  |

## Both-platform updates

When a feature exists in both plugins, check both platform content trees before editing.
Do not assume the Roam and Obsidian docs have identical structure or screenshots.

Common both-platform targets:

- Shared concepts: `apps/website/content/<platform>/fundamentals/**`
- Similar workflows: `apps/website/content/<platform>/core-features/**` or `apps/website/content/roam/guides/**`
- Use cases: `apps/website/content/<platform>/use-cases/**`

## Docs-site updates

For changes that only affect the docs website, search `apps/website/content/**`, `_meta.ts` files, and `apps/website/docsRouteMap.ts`.
Do not update plugin feature docs unless the user-facing plugin instructions changed.
