You are working on the Obsidian plugin that implements the Discourse Graph protocol.

## Linting

After editing any Obsidian plugin code, run lint before finishing:

```bash
pnpm --dir apps/obsidian lint
```

That command runs both lint lanes, so fix everything it reports. Pay attention to `obsidianmd/*` violations in particular — they indicate Obsidian plugin store review risks, and clearing them is the only way they get cleared.

The two lanes differ in how CI treats them:

- **Blocking** (`eslint.config.blocking.mjs`) — the shared monorepo React/TS rules. On changed files, any violation on an added line fails the PR check.
- **Advisory** (`eslint.config.advisory.mjs`) — the `obsidianmd/*` rules. CI annotates violations on changed lines but never fails the check over them, because the plugin carries a backlog of pre-existing violations that unrelated changes should not have to clear.

Nothing blocks commits locally: `eslint-plugin-only-warn` in the shared preset downgrades every rule to a warning, so ESLint always exits 0. The lint-staged hook applies `--fix` and moves on. Enforcement happens in CI, on added lines only.

For manifest and store checks that ESLint does not cover (description wording, funding URL, etc.), use the `obsidian-plugin-guidelines` skill in `skills/`.

Note: `apps/obsidian` runs ESLint 9, required by `eslint-plugin-obsidianmd`, while the other apps (roam, website) run ESLint 8. pnpm gives each workspace its own copy, but the shared `@repo/eslint-config` preset is written against ESLint 8 and typescript-eslint 7 — so a change to that preset can break `apps/obsidian` alone. Run this app's lint after touching it.

## Dependencies

Prefer existing dependencies from package.json.

## Obsidian Style Guide

Use the obsidian style guide from help.obsidian.md/style-guide and docs.obsidian.md/Developer+policies.

### Icons

Platform-native UI.
Lucide and custom Obsidian icons can be used alongside detailed elements to provide a visual representation of a feature.

Example: In the ribbon on the left, select Create new canvas ( lucide-layout-dashboard.svg > icon ) to create a canvas in the same folder as the active file.

Guidelines for icons

Store icons in the Attachments/icons folder.
Add the prefix lucide- before the Lucide icon name.
Add the prefix obsidian-icon- before the Obsidian icon name.
Example: The icon for creating a new canvas should be named lucide-layout-dashboard.

Use the SVG version of the icons available.
Icons should be 18 pixels in width, 18 pixels in height, and have a stroke width of 1.5. You can adjust these settings in the SVG data.
Adjusting size and stroke in an SVG.
Utilize the icon anchor in embedded images, to tweak the spacing around the icon so that it aligns neatly with the text in the vicinity.
Icons should be surrounded by parenthesis. ( lucide-cog.svg > icon )
Example: ( ![[lucide-cog.svg#icon]] )

### Function guides

- Any function that deals with querying vault's frontmatter, default to using Datacore API first, then write fallback where you use `plugin.app.vault.getMarkdownFiles()` to iterate through each file's frontmatter

## Plugin Store Guidelines

These rules must be followed for the plugin to be accepted into the Obsidian community plugin store.

### Security

- Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with user-controlled content
- Use Obsidian DOM helpers instead: `createEl()`, `createDiv()`, `createSpan()`

### App instance

- Always use `this.app` — never the global `app` object

### Event listeners

- Register all event listeners via `this.registerEvent()` so they are automatically cleaned up on plugin unload

### UI text

- Use sentence case in settings headings and labels (not title case)
- Prefer `setHeading()` over raw HTML heading elements (`<h1>`, `<h2>`, etc.)

### Commands

- Do not set default hotkeys — they conflict with other plugins
- Use the correct callback type: `callback` for always-available commands, `checkCallback` when the command is conditionally available, or the editor variants for editor-scoped commands
- Do not manually prepend the plugin ID to command IDs — Obsidian adds it automatically

### Workspace

- Do not store references to custom views — look them up fresh each time they are needed
  Don't do this:
  `this.registerView(MY_VIEW_TYPE, () => this.view = new MyCustomView());`
  Do this instead:
  `this.registerView(MY_VIEW_TYPE, () => new MyCustomView());`
  To access the view from your plugin, use `Workspace.getActiveLeavesOfType():`

```
for (let leaf of app.workspace.getActiveLeavesOfType(MY_VIEW_TYPE)) {
  let view = leaf.view;
  if (view instanceof MyCustomView) {
    // ...
  }
}
```

- Do not detach leaves during plugin unload

### Editor

- Prefer the Editor API over `Vault.modify()` when the note is currently open in the editor
- Prefer `Vault.process()` instead of `Vault.modify()` to modify a file in the background

### Mobile compatibility

- Node.js and Electron APIs (`fs`, `crypto`, `os`) are unavailable on mobile
- If the plugin targets mobile, use web API equivalents: `SubtleCrypto` instead of `crypto`, `navigator.clipboard` for clipboard access
- Regex lookbehind assertions are not supported on some mobile — avoid them if possible

### Code quality

- Use `const`/`let` — never `var`
- Prefer `async`/`await` over `.then()` chains
- Minimize `console.log` — remove debug logs before shipping
- Do not hardcode styles inline — use CSS classes and Obsidian's CSS variables
