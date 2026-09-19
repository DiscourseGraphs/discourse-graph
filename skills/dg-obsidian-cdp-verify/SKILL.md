---
name: dg-obsidian-cdp-verify
description: Verify Obsidian plugin changes by driving the running app over the Chrome DevTools Protocol and asserting on real behaviour. Use when a change needs proving in the real app rather than by unit test — apps/obsidian has no test runner — or when a reviewer asks "does this actually work?".
---

# DG Obsidian CDP Verify

Use this skill to prove an `apps/obsidian` change works in a real Obsidian vault.

`apps/obsidian` has no test runner (roam, website, database and content-model do).
The way to prove a change works is to drive the real app: Obsidian is Electron, so
it speaks the Chrome DevTools Protocol. About 150 lines covers `evaluate`, input
injection and condition polling — Playwright is not required.

## Prerequisites

1. **Relaunch Obsidian with the debug port.** Run the steps separately — the
   auto-mode classifier blocks quit-and-relaunch as one compound command.
   ```bash
   osascript -e 'tell application "Obsidian" to quit'
   ```
   ```bash
   open -na /Applications/Obsidian.app --args --remote-debugging-port=9222
   ```
   Ask the user before doing this: it closes their running app.
2. **Your build in the vault.** `apps/obsidian/.env` mirrors the dev build into
   the vault plugin dir. Confirm it is _your_ build — see the first gotcha.

## Quick Start

```sh
# 1. preflight: port up, right vault, YOUR bundle, plugin enabled
node skills/dg-obsidian-cdp-verify/scripts/preflight.mjs "a string unique to your change"

# 2. run a verification
node skills/dg-obsidian-cdp-verify/examples/insert-link-at-cursor.mjs
```

Set `VAULT` to target a vault other than `testVault`.

Write the verification as scenarios and hand them to `runVerification`, which owns
everything order-dependent (plugin reload, stray-modal cleanup, teardown, exit
code):

```js
import { runVerification } from "./scripts/harness.mjs";

await runVerification({
  modalSelector: ".dg-node-search-modal",
  setup: async ({ client }) => ({
    /* snapshot anything you will mutate */
  }),
  teardown: async ({ client, state }) => {
    /* put it back */
  },
  scenarios: [
    {
      name: "01-does-the-thing",
      body: async ({ client, check, state }) => {
        await client.evaluate(`return app.commands.executeCommandById("…");`);
        await client.waitFor(`!!document.querySelector(".my-modal")`, {
          label: "modal",
        });
        check(
          "the thing happened",
          await client.evaluate(`…`),
          "detail on failure",
        );
      },
    },
  ],
});
```

`client` gives you `evaluate`, `waitFor`, `key`, `typeText`, `reloadPlugin` and
`pressEscape`. See `examples/insert-link-at-cursor.mjs` — the real
verification that shipped ENG-2114 (15 assertions, 3 scenarios). Copy it as the
starting point for a new one.

## Gotchas

Each of these cost real debugging time. The second and third produced confident,
wrong diagnoses that survived until they were deliberately tested.

| Symptom                                               | Cause                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "My feature is missing from the build"                | **Every worktree's dev watcher mirrors into the same vault plugin dir.** Another branch's watcher silently overwrote your bundle. This is what `preflight.mjs` checks. Find competing watchers with `pgrep -fl "scripts/dev.ts"`; rebuild with `(cd apps/obsidian && pnpm build)`. |
| App appears to double-handle one keypress             | Your key helper spread `{ type, ...opts }`, so a caller's `type: "keyDown"` overrode the loop and sent two keydowns. `type` must come **after** the spread.                                                                                                                        |
| `editor.hasFocus()` is false but focus looks right    | CodeMirror ANDs with `document.hasFocus()`, so it reports false whenever Obsidian is not the frontmost macOS app — running a build in the terminal flips it. Assert `document.activeElement.closest(".cm-editor")` instead.                                                        |
| File content assertion fails, editor looks correct    | Obsidian saves on a debounce. Poll the file until it changes; never read straight after the action.                                                                                                                                                                                |
| Assertions read a mix of two modals                   | A crashed earlier run left one mounted. `runVerification` clears strays first; a synthetic `body.click()` will not dismiss a modal, an Escape key event will.                                                                                                                      |
| `getLeaf(true)` throws "No tab group found"           | You detached every markdown leaf first. Use `getLeaf("tab")`, which reuses an empty active leaf.                                                                                                                                                                                   |
| Editing only files under `src/styles/` never rebuilds | The concatenation runs in esbuild's `onEnd`, outside its module graph. Touch a `.ts` file.                                                                                                                                                                                         |
| Top-level `await` throws inside `evaluate`            | Bodies are wrapped in a plain function. Return a promise chain instead.                                                                                                                                                                                                            |
| Wrong window driven                                   | Several page targets exist — one per open vault, plus popouts and settings. Select by `app.vault.getName()`, never by title.                                                                                                                                                       |

Two more, from experience rather than symptoms:

- **Reset state at the start of a scenario**, or assertions inherit leftover tabs
  and splits from the last run and a correct implementation reads as a failure.
- **The developer is using the app while you drive it.** A human opening a tab
  mid-run produces failures that look like code bugs. Re-run before believing a
  causal story built on one observation.

## Safety Notes

- Ask before relaunching Obsidian: it closes the app the developer is using.
- Verification runs mutate the vault — scratch notes, sometimes app settings.
  Snapshot anything you change in `setup` and restore it in `teardown`.
- Point runs at a dev vault (`testVault`), never a real one.
