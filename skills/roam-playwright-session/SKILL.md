---
name: roam-playwright-session
description: Open Roam Research with a Discourse Graphs Playwright test account and persistent profile for apps/roam extension testing. Use when developing or verifying the Discourse Graphs Roam extension, rotating between the three local Playwright Roam accounts, capturing screenshot proof, or inspecting live Roam DOM behavior from this repository.
---

# DG Roam Playwright Session

Use this skill to open a real Roam Research graph with one of the local Playwright test accounts.

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

## Safety Notes

- Only one Chromium process can own a persistent profile at a time.
- Use a different `--slot` for concurrent agents.
- Use `--headed --allow-login` if manual login recovery is needed.
- Do not run Supabase smoke tests as part of this skill; this skill is only for Roam login/session proof.
