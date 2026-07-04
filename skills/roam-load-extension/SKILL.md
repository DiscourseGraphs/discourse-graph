---
name: dg-roam-load-extension
description: Build and load the local Discourse Graphs apps/roam extension into Roam Research through Roam Depot developer mode using a Playwright test account. Use when verifying local apps/roam changes in a real Roam graph, checking that DG commands/settings load, or capturing proof after loading apps/roam/dist.
---

# DG Roam Load Extension

Use this skill to build `apps/roam`, load `apps/roam/dist` through Roam Depot developer mode, and verify that the Discourse Graphs extension is active.

It composes with `dg-roam-playwright-session` for account/profile selection.

## Quick Start

```sh
pnpm --filter roam playwright:load-extension -- --slot 1
```

Use another slot for isolated work:

```sh
pnpm --filter roam playwright:load-extension -- --slot 2
```

The script builds `apps/roam` by default, loads `apps/roam/dist`, verifies `window.roamjs.extension.queryBuilder`, and writes proof under `local/roam-playwright/artifacts`.

## Options

- `--slot 1|2|3`: Select the Roam account/profile.
- `--skip-build`: Load the existing `apps/roam/dist` without rebuilding.
- `--headed`: Run with a visible Chromium window.
- `--keep-open`: Leave the browser open after loading.
- `--dist <path>`: Load a different Roam extension folder. Use only when intentionally testing another build output.

## Folder Loading

Roam Depot's folder button calls `window.showDirectoryPicker()`, not an `<input type="file">`. The script installs a temporary in-page directory-picker shim backed by the files in `apps/roam/dist`.

An IndexedDB clone warning for the fake directory handle is expected. Treat successful DG global verification and screenshot proof as the source of truth.

## Safety Notes

- Do not commit `.env`, browser profiles, or artifacts.
- Do not commit real Roam test account emails, graph names, graph URLs, or proof screenshots.
- Do not change Supabase local/branch/production config as part of this skill.
- Do not run production-backend smoke tests in this workflow.
