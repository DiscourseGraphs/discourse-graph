---
name: dg-roam-playwright-session
description: Open one authenticated Roam Research Playwright context with a Discourse Graphs test slot on Windows or macOS. Use when testing apps/roam, capturing proof, inspecting live Roam behavior, or reusing the same page and profile across several checks.
---

# DG Roam Playwright Session

Use this skill to open a real Roam Research graph once, run all checks in the returned context, capture proof, and close it cleanly.

Secrets must live only in the ignored `apps/roam/.env`. Do not print, inspect, or commit passwords, cookies, local storage, or Playwright profile contents.

## Quick Start

Open slot 1:

```sh
pnpm --filter roam playwright:open -- --slot 1
```

Use slots 2 or 3 for isolated concurrent work:

```sh
pnpm --filter roam playwright:open -- --slot 2
pnpm --filter roam playwright:open -- --slot 3
```

The script writes screenshots and JSON proof under `local/roam-playwright/artifacts`.

For loading `apps/roam/dist` and running a feature test in the same context, use `dg-roam-load-extension` instead of creating a temporary browser harness.

## Environment

The ignored `apps/roam/.env` should contain one set per slot:

```sh
DG_ROAM_PLAYWRIGHT_EMAIL_1=
DG_ROAM_PLAYWRIGHT_PASSWORD_1=
DG_ROAM_PLAYWRIGHT_GRAPH_URL_1=
DG_ROAM_PLAYWRIGHT_PROFILE_DIR_1=
```

Repeat for `_2` and `_3`.

Account emails and graph URLs are intentionally required from the ignored app `.env`. Do not add real test account identifiers, graph names, graph URLs, or passwords to committed files.

Profile directories default to ignored local paths under `local/roam-playwright/profiles/`.

The repo-relative `.env`, profile, and artifact paths work on Windows and macOS. Override them only when the slot needs a different local location:

- `DG_ROAM_PLAYWRIGHT_ENV_PATH`: alternate ignored environment file.
- `DG_ROAM_PLAYWRIGHT_PROFILE_DIR_<slot>` or `--profile-dir`: slot profile.
- `--out`: proof output directory.

When importing `openRoamSession`, keep the returned session and call `session.close()` in `finally`. A failed navigation or readiness check closes the context automatically.

## Safety Notes

- Only one Chromium process can own a persistent profile at a time.
- A profile-lock error identifies the occupied slot and path. Close that session or use another `--slot`; do not delete lock files.
- Use `--headed --allow-login` if manual login recovery is needed.
- Credential values never belong in result JSON or diagnostics.
- Do not run Supabase smoke tests as part of this skill; this skill is only for Roam login/session proof.
