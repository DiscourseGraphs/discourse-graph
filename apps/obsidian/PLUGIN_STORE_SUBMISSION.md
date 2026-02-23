# Obsidian Plugin Store Submission Fixes

This document tracks all the changes made to address failed criteria from the [Obsidian Plugin Submission Checklist](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins).

## Index of Failed Criteria

### Submission Requirements

#### [SR-4] Description must start with action statement (verb)
- **Issue**: Current description "Discourse Graph Plugin for Obsidian" doesn't start with a verb
- **Fix**: Changed to "Add semantic structure to your notes with the Discourse Graph protocol."
- **Files affected**: `manifest.json`

#### [SR-5] Description must end with a period
- **Issue**: Missing trailing period in description
- **Fix**: Added period to description
- **Files affected**: `manifest.json`

### Plugin Guidelines - General

#### [PG-G2] Avoid unnecessary logging to console
- **Issue**: ~87 console statements (~20 `console.log`, ~47 `console.warn`, ~14 `console.debug`)
- **Fix**: Removed/replaced console statements with proper error handling or removed debug logs
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

#### [PG-UI7] Only use headings under settings if you have more than one section
- **Issue**: `Settings.tsx:32` renders top-level `<h2>Discourse Graph Settings</h2>` unnecessarily
- **Fix**: Removed top-level heading
- **Files affected**: `src/components/Settings.tsx`

#### [PG-UI8] Avoid "settings" in settings headings
- **Issue**: Top-level heading says "Discourse Graph Settings"
- **Fix**: Removed as part of [PG-UI7]
- **Files affected**: `src/components/Settings.tsx`

#### [PG-UI10] Use setHeading() instead of createElement for headings
- **Issue**: `ConfirmationModal.tsx:24` uses `createEl("h2")`
- **Fix**: Replaced with `setHeading()` method
- **Files affected**: `src/components/ConfirmationModal.tsx`

### Plugin Guidelines - Resource Management

#### [PG-RM13] Don't detach leaves in onunload
- **Issue**: `src/index.ts:414` calls `this.app.workspace.detachLeavesOfType(VIEW_TYPE_DISCOURSE_CONTEXT)`
- **Fix**: Removed detachLeavesOfType call (Obsidian handles cleanup automatically)
- **Files affected**: `src/index.ts`

### Plugin Guidelines - Commands

#### [PG-C14] Avoid setting a default hotkey for commands
- **Issue**: `registerCommands.ts:64` sets `hotkeys: [{ modifiers: ["Mod"], key: "\\" }]` on `open-node-type-menu`
- **Fix**: Removed default hotkey (users can set their own)
- **Files affected**: `src/utils/registerCommands.ts`

### Plugin Guidelines - Workspace

#### [PG-W16] Avoid accessing workspace.activeLeaf directly
- **Issue**: 3 instances in `registerCommands.ts:191, 208` and `tagNodeHandler.ts:625, 633, 635`
- **Fix**: Replaced with `workspace.getActiveViewOfType()` or appropriate methods
- **Files affected**: 
  - `src/utils/registerCommands.ts`
  - `src/utils/tagNodeHandler.ts`

### Plugin Guidelines - Vault

#### [PG-V19] Prefer Vault.process instead of Vault.modify for background edits
- **Issue**: 3 instances modifying non-active files in `BulkIdentifyDiscourseNodesModal.tsx:146`, `importNodes.ts:1070, 1266`
- **Fix**: Replaced `vault.modify()` with `vault.process()` for background file modifications
- **Files affected**: 
  - `src/components/BulkIdentifyDiscourseNodesModal.tsx`
  - `src/utils/importNodes.ts`

#### [PG-V20] Prefer FileManager.processFrontMatter for frontmatter
- **Issue**: `templates.ts:142` uses deprecated `getFrontMatterInfo()`
- **Fix**: Replaced with `app.fileManager.processFrontMatter()`
- **Files affected**: `src/utils/templates.ts`

#### [PG-V21] Prefer Vault API over Adapter API
- **Issue**: 5 instances of `vault.adapter.exists()` in `importNodes.ts:810, 816, 1158, 1209, 1283`
- **Fix**: Replaced with `vault.getAbstractFileByPath() !== null`
- **Files affected**: `src/utils/importNodes.ts`

### Plugin Guidelines - Styling

#### [PG-S25] No hardcoded styling
- **Issue**: ~70+ inline `style={{ }}` and `.style.` assignments in multiple files
- **Analysis**: Most inline styles are dynamic (positioning based on runtime element positions, using variable colors from node types). These are acceptable per Obsidian guidelines which prohibit *hardcoded* values, not dynamic styles.
- **Fix**: Added CSS classes for truly hardcoded values like `cursor: pointer`. Dynamic styles (popover positioning, colors from variables, measurement elements) are kept as inline styles as they cannot be static.
- **Files affected**: 
  - `src/styles/style.css` (added utility classes)
  - `src/utils/tagNodeHandler.ts` (use CSS class for cursor)
  
**Note**: Dynamic inline styles that use:
- Calculated positions (popover placement, tooltip positioning)
- Runtime color variables (nodeType.color, relationType.color)
- Temporary measurement elements (measureNodeText.ts)
are considered acceptable and were not changed.

## Verification Checklist

After applying all fixes, verify:

- [ ] Plugin builds without errors
- [ ] All settings tabs render correctly
- [ ] Commands work as expected (without default hotkeys)
- [ ] File operations work correctly with new Vault API methods
- [ ] UI elements display properly with CSS classes instead of inline styles
- [ ] No console logging in production code
- [ ] Plugin can be loaded and unloaded without errors
