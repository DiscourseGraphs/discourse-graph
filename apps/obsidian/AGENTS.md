You are working on the Obsidian plugin that implements the Discourse Graph protocol.

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

## Unit tests

Vitest runs the plugin's pure logic in a Node environment: `pnpm test:unit` (or `pnpm test:watch` while working). The repository-wide `pnpm ci:validate` picks it up through the `test:unit` script.

- Put tests in `src/**/__tests__/<module>.test.ts`, next to the code they cover. Tests covering the test scaffolding itself live in `test/`; those two globs are the whole of `include` in `vitest.config.mts`.
- Import the module under test through the `~` alias, as the source does.
- `obsidian` ships type declarations with no runtime entry point, so `vitest.config.mts` aliases it to `test/obsidianStub.ts`. Add to that stub whatever a new test needs to load its module; use `vi.mock("obsidian")` in the test itself when the test needs to assert on a call.
- Obsidian's own objects are large. Build the slice the code path reads and cast it (`{ metadataCache: … } as unknown as App`) rather than constructing a whole `App` or `TFile`.
- Logic that needs a live vault, editor, or workspace is not covered here — extract the decision into a util and test that.

### Keeping the stub honest

The stub is hand-written, so it can be wrong about the API today and can fall behind when the `obsidian` dependency is bumped. Two mechanisms catch that. Each runs under exactly one command, so run `pnpm ci:validate` to get both.

`test/obsidianStub.conformance.ts` type-checks each stub member against the real declaration. It is type-only and matches none of the vitest globs, so only `pnpm check-types` enforces it. Keep it inside the `tsconfig.json` include, or the drift check disappears with no signal.

- Members with real behavior are fully conformant.
- Shells, which exist only so an importing module loads, are checked for the export name alone. When a shell gains behavior, move it to the conformant group.
- Every export must appear in one group or the other, so adding one without classifying it fails the build.

`test/obsidianStub.test.ts` pins the behavior the stub reimplements, which the type checker cannot see. It is type-checked like any other file, but only `pnpm test:unit` runs its assertions.

### Verifying the stub

Type declarations cannot tell you what a function returns for a given input, so do not guess it. Obsidian ships its implementation in `obsidian.asar`, in the resources directory of the installed app, and the current cases were settled by reading it. Two details it settled: `normalizePath("/")` returns `"/"`, and `TFolder.isRoot()` tests `path === "/"` rather than a null parent.

The bundle is minified, so it takes two steps: find the exported name to learn its minified name, then find that function. The example below is a macOS path; on Windows and Linux locate `obsidian.asar` under the install directory and substitute it.

```
node -e 'const s=require("fs").readFileSync("/Applications/Obsidian.app/Contents/Resources/obsidian.asar","utf8");
  const i=s.indexOf("normalizePath:()=>");
  console.log(s.slice(i, i+80));'
```

Read the behavior and reimplement it; do not paste the bundle's code into this repository. Pin whatever you learn in `obsidianStub.test.ts`, and name the test `diverges: …` when the stub deliberately does something else.
