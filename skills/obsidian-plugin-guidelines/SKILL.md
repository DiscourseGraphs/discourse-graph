---
name: obsidian-plugin-guidelines
description: Audit the Obsidian plugin against the official Obsidian plugin store submission requirements and plugin guidelines. Reports violations and suggests fixes.
---

You are auditing the Discourse Graph Obsidian plugin (`apps/obsidian/`) for compliance with the official Obsidian community plugin store guidelines.

## Step 0 — Run ESLint

Run the Obsidian linter and fix all reported issues before the manual audit:

```bash
pnpm --dir apps/obsidian lint
```

ESLint catches many store-review issues automatically (`obsidianmd/*` rules). Fix all warnings and errors reported by `obsidianmd/*` rules before proceeding. CI reports these as advisory and will not fail a pull request over them, so an audit is the point at which they get cleared. Steps 1–9 below cover checks that ESLint does not automate (manifest wording, funding URL, etc.).

## Step 1 — Read the manifest

Read `apps/obsidian/manifest.json` and check:

- [ ] `minAppVersion` is set (not empty, not `0.0.0`)
- [ ] `isDesktopOnly` is `true` if the plugin uses Node.js or Electron APIs; otherwise it can be omitted or `false`
- [ ] `fundingUrl`, if present, points to a recognized donation platform (Buy Me A Coffee, GitHub Sponsors, Patreon, etc.)
- [ ] `description` starts with an action-oriented phrase, is ≤250 characters, ends with a period, contains no emoji or special characters, and does not start with "This is a plugin"
- [ ] Proper nouns are capitalized correctly in `description`: "Obsidian", "Markdown", "PDF"

## Step 2 — Security scan

Search the source (`apps/obsidian/src/`) for:

- `innerHTML` — flag any assignment using user input
- `outerHTML` — flag any assignment using user input
- `insertAdjacentHTML` — flag any call using user input

Allowed: assignments to static, developer-controlled strings. Flag everything else.

## Step 3 — Global app object

Search for uses of the bare global `app` (not `this.app`, not `plugin.app`). These should use `this.app` or `plugin.app` instead.

## Step 4 — Event listener cleanup

Search for `addEventListener` calls that are NOT wrapped in `this.registerEvent()`. Every DOM event listener on external elements must be registered for automatic cleanup.

## Step 5 — Command IDs

Search for command registrations and verify no command `id` manually includes the plugin ID as a prefix (Obsidian prepends it automatically).

Search for default hotkeys (`hotkeys: [...]` in `addCommand`) — these must be removed.

## Step 6 — Workspace patterns

- Flag any direct leaf access (`workspace.activeLeaf`) used instead of `getActiveViewOfType()`
- Flag any stored references to custom view instances as class fields

## Step 7 — Mobile compatibility

If `isDesktopOnly` is `false` or absent, check for usage of:

- `require('fs')` / `require('crypto')` / `require('os')`
- Regex lookbehind assertions (`(?<=...)`, `(?<!...)`)

Flag any found as mobile-incompatible.

## Step 8 — Code quality checks

- Search for `var ` declarations — should use `const` or `let`
- Search for `console.log` calls — should be minimized; flag if more than a handful exist
- Search for inline `style=` attribute strings set programmatically — should use CSS classes

## Step 9 — Template code removal

Search for common Obsidian plugin scaffold boilerplate (e.g. `SampleModal`, `SampleSettingTab`, placeholder class names) and flag any that remain.

## Step 10 — Report

Output a structured report:

```
## Obsidian Plugin Store Compliance Report

### ✅ Passing
- (list checks that passed)

### ⚠️ Violations
- **[Category]** File:line — description of issue and suggested fix

### 📋 Summary
X violations found across Y categories.
```

If there are violations, ask the user if they want you to fix them automatically.
