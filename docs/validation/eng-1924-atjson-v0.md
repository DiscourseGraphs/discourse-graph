# ENG-1924 manual validation pass

Validated on 2026-08-30 from the `codex/v0-content-model-canonical-atjson-storage` branch.

## Result

The storage, API, and production-build prerequisites for the host workflows pass. Live host-app validation is not complete and remains a rollout gate. This draft PR is suitable for implementation inspection, but it should not be promoted from draft until the two blocked checks below are run in configured test hosts.

## Confirmed

| Area                           | Evidence                                                                                                                                                                                 | Result |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Canonical conversion           | `@repo/content-model` unit suite: 30 tests                                                                                                                                               | Pass   |
| Migrated storage               | Local Supabase Cucumber suite: 20 scenarios, 203 steps                                                                                                                                   | Pass   |
| Representation coexistence     | Database regression stores native Markdown and ATJSON together, keeps ATJSON in `metadata.content`, keeps plain text in `Content.text`, and preserves the native full-row file reference | Pass   |
| Embedding isolation            | Database, Obsidian, and Roam regressions reject or ignore non-plain embedding inputs                                                                                                     | Pass   |
| Website boundary               | Resolve/upsert route unit suite: 3 tests                                                                                                                                                 | Pass   |
| Obsidian adapter flow          | Dual-write and embedding-guard unit suite: 2 tests; production build completes                                                                                                           | Pass   |
| Roam adapter flow              | Unit suite: 112 tests; production build completes                                                                                                                                        | Pass   |
| Website production integration | Next production build completes with non-secret build-only placeholders for required email and analytics constructors                                                                    | Pass   |

The local database suite was run against a reset Docker-backed Supabase test database. It confirmed that native rows remain the compatibility representation after canonical ATJSON rows exist.

## Blocked live-host checks

### Roam local-to-remote sync

The repository's `playwright:load-extension` workflow rebuilt the extension successfully, then stopped before opening Roam because the ignored `apps/roam/.env` does not contain slot 1's test graph URL, email, and password. No account identifiers or credentials were printed or committed.

Before rollout, configure a Playwright test slot and confirm:

1. Load `apps/roam/dist` through Roam Depot developer mode.
2. Sync a local node to the migrated test storage.
3. Verify native Roam Markdown and canonical ATJSON full rows coexist.
4. Verify the native reader still materializes the node and no JSON appears in rendered text or embeddings.

### Obsidian publish/import

The production plugin artifact built successfully. Obsidian is installed locally, but the Windows automation launch approval timed out before a vault was opened, so no vault or plugin state was modified.

Before rollout, use an isolated test vault and confirm:

1. Publish a Markdown note with frontmatter and a file reference.
2. Verify direct plain text, native full Markdown, and canonical full ATJSON rows coexist.
3. Import the note and confirm the current native Markdown path is selected.
4. Republish an edit and confirm the native row updates without duplicating representations or losing the file reference.

## Rollout decision

Keep the pull request in draft. The remaining live-host checks are explicitly tracked by ENG-1924 and must be recorded here or in the issue before rollout.
