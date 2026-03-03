# Obsidian Plugin Store Submission Fixes

This document tracks all the changes made to address failed criteria from the [Obsidian Plugin Submission Requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins) and [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).

## Index of Addressed Criteria

### Submission Requirements

#### Keep plugin descriptions short and simple
[Docs](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins#Keep+plugin+descriptions+short+and+simple)
- **Issue**: Description "Discourse Graph Plugin for Obsidian" doesn't start with a verb and is missing a trailing period
- **Fix**: Changed to "Add semantic structure to your notes with the Discourse Graph protocol."
- **Files affected**: `manifest.json`

### Plugin Guidelines - General

#### Avoid unnecessary logging to console
[Docs](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Avoid+unnecessary+logging+to+console)
- **Issue**: ~87 console statements (`console.log`, `console.warn`, `console.debug`)
- **Fix**: Removed console statements; retained `console.error` for legitimate error handling
- **Files affected**:
  - `src/services/QueryEngine.ts`
  - `src/utils/syncDgNodesToSupabase.ts`
  - `src/utils/importNodes.ts`
  - `src/utils/fileChangeListener.ts`
  - `src/components/canvas/TldrawView.tsx`
  - `src/components/canvas/utils/relationJsonUtils.ts`
  - `src/utils/templates.ts`
  - `src/utils/publishNode.ts`

### Plugin Guidelines - UI Text

#### Only use headings under settings if you have more than one section
[Docs](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Only+use+headings+under+settings+if+you+have+more+than+one+section.)
- **Issue**: `Settings.tsx` renders a top-level `<h2>Discourse Graph Settings</h2>` heading
- **Fix**: Removed top-level heading (also addresses "Avoid 'settings' in settings headings")
- **Files affected**: `src/components/Settings.tsx`

### Plugin Guidelines - Commands

#### Avoid setting a default hotkey for commands
[Docs](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Avoid+setting+a+default+hotkey+for+commands)
- **Issue**: `registerCommands.ts` sets `hotkeys: [{ modifiers: ["Mod"], key: "\\" }]` on `open-node-type-menu`
- **Fix**: Removed default hotkey (users can set their own in Obsidian settings)
- **Files affected**: `src/utils/registerCommands.ts`

### Plugin Guidelines - Workspace

#### Avoid accessing workspace.activeLeaf directly
[Docs](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Avoid+accessing+%60workspace.activeLeaf%60+directly)
- **Issue**: 2 instances of `workspace.activeLeaf` in `registerCommands.ts`
- **Fix**: Replaced with `workspace.getActiveViewOfType()`
- **Files affected**: `src/utils/registerCommands.ts`

### Plugin Guidelines - Vault

#### Prefer Vault.process instead of Vault.modify for background edits
[Docs](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Prefer+%60Vault.process%60+instead+of+%60Vault.modify%60+to+modify+a+file+in+the+background)
- **Issue**: 3 instances of `vault.modify()` used on non-active files
- **Fix**: Replaced with `vault.process()` for atomic background file modifications
- **Files affected**:
  - `src/components/BulkIdentifyDiscourseNodesModal.tsx`
  - `src/utils/importNodes.ts`

#### Replace deprecated getFrontMatterInfo
- **Issue**: `templates.ts` uses deprecated `getFrontMatterInfo()` from Obsidian API
- **Fix**: Replaced with a custom `parseFrontmatterFromString()` helper that returns the same `{ exists, contentStart }` shape
- **Files affected**: `src/utils/templates.ts`

## Verification Checklist

After applying all fixes, verify:

- [ ] Plugin builds without errors
- [ ] All settings tabs render correctly
- [ ] Commands work as expected (without default hotkeys)
- [ ] File operations work correctly with new Vault API methods
- [ ] No console logging in production code
- [ ] Plugin can be loaded and unloaded without errors
