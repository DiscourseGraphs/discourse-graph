---
name: dg-roam-load-extension
description: Build, register, activate, and verify the local Discourse Graphs Roam extension, then run an optional feature test in the same Playwright context. Use for live apps/roam proof on Windows or macOS without repeating browser, login, and folder-loading setup.
---

# DG Roam Load Extension

Use this skill for one complete lifecycle: build `apps/roam`, open an authenticated slot, register `apps/roam/dist`, activate it, verify DG runtime readiness, run an optional caller test, capture proof, and close.

It composes with `dg-roam-playwright-session` for account/profile selection.

## Quick Start

```sh
pnpm --filter roam playwright:loadExtension -- --slot 1
```

Use another slot for isolated work:

```sh
pnpm --filter roam playwright:loadExtension -- --slot 2
```

The script builds by default, verifies `window.roamjs.extension.queryBuilder`, checks the DG settings UI, and writes proof under `local/roam-playwright/artifacts`.

To add feature-specific assertions without copying the loader, pass an ESM test module:

```sh
pnpm --filter roam playwright:loadExtension -- --slot 1 --test-module ./local/roam-playwright/feature-proof.mjs
```

```js
export default {
  readySelector: "[data-testid='feature-ready']",
  async ready({ page }) {
    return page.evaluate(() => Boolean(window.myFeature?.ready));
  },
  async run({ page, outDir }) {
    await page.getByText("Expected output").waitFor();
    return { assertion: "passed" };
  },
  async cleanup({ page, state }) {
    // Remove only fixtures created by run().
  },
};
```

`run()` starts only after the standard DG runtime proof and any caller readiness hook succeeds. `cleanup()` runs when `run()` started, including after a failed assertion. Return JSON-serializable proof values.

## Options

- `--slot 1|2|3`: Select the Roam account/profile.
- `--skip-build`: Load the existing `apps/roam/dist` without rebuilding.
- `--headed`: Run with a visible Chromium window.
- `--keep-open`: Leave the browser open after loading.
- `--dist <path>`: Load a different Roam extension folder. Use only when intentionally testing another build output.
- `--registration-name <name>`: Developer Extensions row name. Defaults to the built folder name, usually `dist`.
- `--test-module <path>`: Caller readiness, test, and cleanup hooks. Absolute Windows paths and paths containing spaces are supported.
- `--out <path>` and `--screenshot-name <name>`: Proof artifact locations.
- `--timeout <ms>`: UI and readiness timeout. Defaults to `45000`.

## Folder Loading

Roam Depot's folder button calls `window.showDirectoryPicker()`, not an `<input type="file">`. The script installs a temporary in-page directory-picker shim backed by the files in `apps/roam/dist`.

The loader uses native Playwright clicks for developer mode and folder controls. It treats the extension row as registration only, then clicks the header or row refresh control when present and waits for DG runtime proof. Roam versions that activate automatically may expose no refresh control.

An IndexedDB clone warning for the fake directory handle is expected and classified separately. Other page exceptions fail the run. `last-run.json` includes phase timings and bounded browser diagnostics; failures also capture a dedicated screenshot and compact DOM state.

## Safety Notes

- Do not commit `.env`, browser profiles, or artifacts.
- Do not commit real Roam test account emails, graph names, graph URLs, or proof screenshots.
- Keep feature fixtures, command interactions, and assertions in the caller module. Do not add them to the generic loader.
- Do not change Supabase local/branch/production config as part of this skill.
- Do not run production-backend smoke tests in this workflow.
