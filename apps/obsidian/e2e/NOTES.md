# E2E Testing for Obsidian Plugin — Notes

## Approaches Considered

### Option 1: Playwright `electron.launch()`

The standard Playwright approach for Electron apps — point `executablePath` at the binary and let Playwright manage the process lifecycle.

**Pros:**

- First-class Playwright API — `app.evaluate()` runs code in the main process, not just renderer
- Automatic process lifecycle management (launch, close, cleanup)
- Access to Electron-specific APIs (e.g., `app.evaluate(() => process.env)`)
- Well-documented, widely used for Electron testing

**Cons:**

- **Does not work with Obsidian.** Obsidian's executable is a launcher that loads an `.asar` package (`obsidian-1.11.7.asar`) and forks a new Electron process. Playwright connects to the initial process, which exits, causing `kill EPERM` and connection failures.
- No workaround without modifying Obsidian's startup or using a custom Electron shell

**Verdict:** Not viable for Obsidian.

---

### Option 2: CDP via `chromium.connectOverCDP()` (chosen)

Launch Obsidian as a subprocess with `--remote-debugging-port=9222`, then connect via Chrome DevTools Protocol.

**Pros:**

- Works with Obsidian's forked process architecture — the debug port is inherited by the child process
- Full access to renderer via `page.evaluate()` — Obsidian's global `app` object is available
- Keyboard/mouse interaction works normally
- Can take screenshots, traces, and use all Playwright assertions
- Process is managed explicitly — clear control over startup and teardown

**Cons:**

- No main process access (can't call Electron APIs directly, only renderer-side `window`/`app`)
- Must manually manage process lifecycle (spawn, pkill, port polling)
- Fixed debug port (9222) means tests can't run in parallel across multiple Obsidian instances without port management
- Port polling adds ~2-5s startup overhead
- `pkill -f Obsidian` in setup is aggressive — kills ALL Obsidian instances, not just test ones

**Verdict:** Works well for PoC. Sufficient for single-worker CI/local testing.

---

### Option 3: Obsidian's built-in plugin testing (not explored)

Obsidian has no official testing framework. Some community approaches exist (e.g., `obsidian-jest`, hot-reload-based testing), but none are mature or maintained.

**Verdict:** Not a real option today.

---

## What We Learned

### Obsidian internals accessible via `page.evaluate()`

- `app.plugins.plugins["@discourse-graph/obsidian"]` — check plugin loaded
- `app.vault.getMarkdownFiles()` — list files
- `app.vault.read(file)` — read file content
- `app.vault.create(name, content)` — create files
- `app.workspace.openLinkText(path, "", false)` — open a file in the editor
- `app.commands.executeCommandById(id)` — could execute commands directly (alternative to command palette UI)

### Plugin command IDs

Commands are registered with IDs like `@discourse-graph/obsidian:create-discourse-node`. The command palette shows them as "Discourse Graph: Create discourse node".

### Modal DOM structure

The `ModifyNodeModal` renders React inside Obsidian's `.modal-container`:

- Node type: `<select>` element (`.modal-container select`)
- Content: `<input type="text">` (`.modal-container input[type='text']`)
- Confirm: `<button class="mod-cta">`

### Vault configuration

Minimum config for plugin to load:

- `.obsidian/community-plugins.json` → `["@discourse-graph/obsidian"]`
- `.obsidian/app.json` → `{"livePreview": true}` (restricted mode must be off, but this is handled by Obsidian detecting the plugins dir)
- Plugin files (`main.js`, `manifest.json`, `styles.css`) in `.obsidian/plugins/@discourse-graph/obsidian/`

---

## Proposal: Full Agentic Testing Flow

### Goal

AI coding agents (Cursor, Claude Code) can run `pnpm test:e2e` after making changes to automatically verify features work end-to-end. The test suite should be comprehensive enough to catch regressions, fast enough to run frequently, and deterministic enough to trust the results.

### Phase 1: Stabilize the PoC (current state + hardening)

**Isolation improvements:**

- Use a unique temp directory per test run (`os.tmpdir()`) instead of a fixed `test-vault/` path to avoid stale state
- Use a random debug port to allow parallel runs
- Replace `pkill -f Obsidian` with tracking the specific child PID — parse it from `lsof -i :<port>` after launch
- Add a global setup/teardown in Playwright config to manage the single Obsidian instance across all tests

**Reliability improvements:**

- Replace `waitForTimeout()` calls with proper waitFor conditions (e.g., `waitForSelector`, `waitForFunction`)
- Add retry logic for CDP connection (currently fails hard on timeout)
- Add a `test.beforeEach` that resets vault state (delete all non-config files) instead of full vault recreation

### Phase 2: Expand test coverage

**Core plugin features to test:**

- Create each discourse node type (Question, Claim, Evidence, Source)
- Verify frontmatter (`nodeTypeId`) is set correctly
- Verify file naming conventions (e.g., `QUE - `, `CLM - `, `EVD - `, `SRC - `)
- Open node type menu via hotkey (`Cmd+\`)
- Discourse context view toggle
- Settings panel opens and renders

**Vault-level tests:**

- Create multiple nodes and verify they appear in file explorer
- Verify node format regex matching (files follow the format pattern)

**Use `app.commands.executeCommandById()` as the primary way to trigger commands** — faster, more reliable, and avoids flaky command palette typing. Reserve command palette tests for testing the palette itself.

### Phase 3: Agentic integration

**For agents to use the tests effectively:**

1. **Fast feedback loop** — Tests should complete in <30s total. Current PoC is ~14s for 2 tests, which is good. Keep Obsidian running between test files using Playwright's `globalSetup`/`globalTeardown`.

2. **Clear error messages** — When a test fails, the agent needs to understand WHY. Add descriptive assertion messages:

   ```ts
   expect(
     pluginLoaded,
     "Plugin should be loaded — check dist/ is built and plugin ID matches manifest.json",
   ).toBe(true);
   ```

3. **Screenshot-on-failure for visual debugging** — Already configured. Consider adding `page.screenshot()` at key checkpoints even on success, so agents can visually verify state.

4. **Test file organization** — One test file per feature area:

   ```
   e2e/tests/
   ├── plugin-load.spec.ts        # Plugin loads, settings exist
   ├── node-creation.spec.ts      # Create each node type
   ├── command-palette.spec.ts    # Command palette interactions
   ├── discourse-context.spec.ts  # Context view, relations
   └── settings.spec.ts           # Settings panel
   ```

5. **CI integration** — Run in GitHub Actions with a macOS runner. Obsidian would need to be pre-installed on the runner (or downloaded in a setup step). This is the biggest open question — Obsidian doesn't have a headless mode, so CI would need `xvfb` or a virtual display.

6. **Agent-executable test commands:**
   ```bash
   pnpm test:e2e              # run all tests
   pnpm test:e2e -- --grep "node creation"  # run specific tests
   pnpm test:e2e:ui           # interactive Playwright UI (for humans)
   ```

### Phase 4: Advanced (future)

- **Visual regression testing** — Compare screenshots against baselines to catch UI regressions
- **Obsidian version matrix** — Test against multiple Obsidian versions (download different `.asar` files)
- **Headless mode wrapper** — Investigate running Obsidian with `--disable-gpu --headless` flags (may not work due to Obsidian's renderer requirements)
- **Test data fixtures** — Pre-built vaults with specific node/relation configurations for testing complex scenarios
- **Performance benchmarks** — Measure plugin load time, command execution time

### Open Questions

1. **CI runner setup** — How to install Obsidian on GitHub Actions macOS runners? Is there a `.dmg` download URL that's stable? Or do we cache the `.app` bundle?
2. **Obsidian updates** — Obsidian auto-updates the `.asar`. Should tests pin a specific version? How to prevent auto-update during test runs?
3. **Multiple vaults** — Obsidian tracks known vaults globally. Test vaults may accumulate in Obsidian's vault list. Need cleanup strategy.
4. **Restricted mode** — The PoC doesn't explicitly disable restricted mode via config. The plugin loads because the `community-plugins.json` file is present, but a fresh Obsidian install might prompt the user to enable community plugins. Need to investigate if there's a config flag to skip this.
