you don't have to ask to run build for projects/discourse-graph we usually run turbo dev in some terminal so search for that if its running and use its log

## Settings Migration Learnings

### Mistakes to Avoid

1. **Don't say "done" without verifying the full chain** - Always trace: user action → setting change → watcher initialization → handler execution. Check that `setupPullWatchSettings()` is actually called in `index.ts`.

2. **Search ALL naming variations** - When looking for a setting like "Suggestive Mode Enabled", also search for `suggestiveModeEnabled`, `suggestive-mode-enabled`, `suggestive_mode_enabled`. The old and new systems use different conventions.

3. **Clean up dead code from old system** - Check `discourseConfigRef.ts` for old references that need removal. Don't leave stale code that causes confusion.

4. **Fix ALL instances of a pattern** - After fixing one file (e.g., `AdminPanel.tsx`), grep for the same pattern (`useMemo.*getFeatureFlag`, `useMemo.*getSetting`) across ALL files. Common culprits: `HomePersonalSettings.tsx`, `NodeConfig.tsx`.

5. **Check `index.ts` initialization** - Startup code often uses old patterns. Ensure it uses the new accessor system (`getFeatureFlag` from `accessors.ts`), not old config tree lookups.

6. **Don't add redundant defensive code without asking** - If Zod schema has defaults, don't add `?? fallback` patterns. Ask explicitly: "The schema has defaults - should I add fallbacks anyway or trust Zod?" Don't silently add unnecessary code.

7. **Only port what exists** - When migrating UI, only port the panels/settings that currently exist in the component. Don't add new settings or features that weren't there before.

8. **Ask about code patterns you don't understand** - If something seems redundant or confusing (like why we have both `BlockPropFeatureFlagPanel` and `BlockPropFlagPanel`), ask explicitly rather than making assumptions.

9. **Use the components we created** - When migrating settings UI, use the BlockProp* components (`BlockPropFlagPanel`, `BlockPropTextPanel`, `BlockPropNumberPanel`, `BlockPropSelectPanel`, `BlockPropMultiTextPanel`) instead of reimplementing with raw Blueprint components.

### Checklist for Each Setting Migration

- [ ] Search ALL naming variations of the setting
- [ ] Check `discourseConfigRef.ts` for old references to remove
- [ ] Check `index.ts` for startup initialization that needs updating
- [ ] Search for `useMemo.*getFeatureFlag` or `useMemo.*getSetting` patterns
- [ ] Verify pull watcher is initialized in `index.ts` with `setupPullWatchSettings()`
- [ ] Trace full reactive flow: checkbox → setter → pull watcher → handler → UI update
- [ ] Remove dead/unused imports after changes
- [ ] Remove any "reload required" alerts/toasts for settings that are now reactive

### Key Files in Settings System

- `utils/accessors.ts` - New getters/setters for block prop settings
- `utils/hooks.ts` - `useFeatureFlag` hook for reactive UI updates
- `utils/pullWatchers.ts` - Handlers that run when settings change
- `utils/init.ts` - Schema initialization, returns `blockUids` needed for pull watcher
- `utils/discourseConfigRef.ts` - OLD config system (being migrated away from)
- `index.ts` - Plugin initialization, must call `setupPullWatchSettings(blockUids)`

---

## Block Prop Settings Migration - Full Context

### PR Progress (eng-1225-discourse-node-migrate-settings)

**Phase 1: Infrastructure (DONE)**
| Commit | Description | Files |
|--------|-------------|-------|
| `3c66e11` | Zod schema for all settings | `zodSchema.ts`, `zodSchema.example.ts` |
| `8a44004` | ENG-1189: Init block prop schema | `init.ts`, `blockPropsSettingsConfig.ts` |
| `3fbeb9f` | ENG-1187: Accessors (get/set) | `accessors.ts` |
| `eab69b3` | Pull watchers | `pullWatchers.ts` |
| `0fb7fc7` | BlockProp panel components | `BlockPropSettingPanels.tsx` |

**Phase 2: Feature Flags (DONE)**
| Commit | Description |
|--------|-------------|
| `3e98c91` | Feature flag checkbox component |
| `61398c5` | Use `getFeatureFlag()` |
| `9cd0a2c` | Make feature flags fully reactive |

**Phase 3: UI Migrations (PARTIAL)**
| Commit | Description | Files |
|--------|-------------|-------|
| `0a257aa` | ENG-1272: Global settings | `ExportSettings.tsx`, `GeneralSettings.tsx` |
| `f9de2fd` | Suggestive mode flags | |
| `a82cfaf` | Personal settings (flags) | `HomePersonalSettings.tsx` |
| `4075de9` | ENG-1225: Discourse node | `NodeConfig.tsx`, `DiscourseNodeCanvasSettings.tsx` |
| `e8a4bee` | Personal settings (text inputs) | `KeyboardShortcutInput.tsx`, `DiscourseNodeMenu.tsx` |
| `6b3c52f` | Remove unnecessary checks | Zod handles defaults |

---

## Discourse Node Settings Migration

### Pattern Reference

**Old pattern (tree-based):**
```typescript
import setInputSetting from "roamjs-components/util/setInputSetting";
setInputSetting({ blockUid: uid, key: "color", value: newColor });
```

**New pattern (block props):**
```typescript
import { setDiscourseNodeSetting } from "./utils/accessors";
setDiscourseNodeSetting(nodeType, ["canvasSettings", "color"], newColor);
```

**Old pattern (roamjs component):**
```typescript
<TextPanel title="Shortcut" parentUid={node.type} uid={shortcutUid} defaultValue={node.shortcut} />
```

**New pattern (BlockProp component):**
```typescript
<DiscourseNodeTextPanel nodeType={node.type} title="Shortcut" settingKeys={["shortcut"]} defaultValue={node.shortcut} />
```

### Zod Schema Reference

The schema is defined in `utils/zodSchema.ts`:
```typescript
DiscourseNodeSchema = z.object({
  text: z.string(),
  uid: z.string(),
  format: stringWithDefault(""),
  shortcut: stringWithDefault(""),
  tag: stringWithDefault(""),
  description: stringWithDefault(""),
  specification: z.array(ConditionSchema).nullable().optional(),
  template: z.array(RoamNodeSchema).nullable().optional(),
  canvasSettings: CanvasSettingsSchema.partial().nullable().optional(),
  graphOverview: booleanWithDefault(false),
  attributes: z.record(z.string(), z.string()).nullable().optional(),
  overlay: stringWithDefault(""),
  index: z.object({
    conditions: z.array(ConditionSchema).default([]),
    selections: z.array(SelectionSchema).default([]),
  }).nullable().optional(),
  suggestiveRules: SuggestiveRulesSchema.nullable().optional(),
})
```

---

## Full Discourse Node Settings Checklist

### Tab 1: General (`NodeConfig.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Description | `description` | `ValidatedTextareaPanel` + `useDebouncedBlockPropUpdater` | ✅ DONE |
| Shortcut | `shortcut` | `DiscourseNodeTextPanel` | ✅ DONE |
| Tag | `tag` | `ValidatedInputPanel` + `useDebouncedBlockPropUpdater` | ✅ DONE |

### Tab 2: Index (`DiscourseNodeIndex.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Index Query | `index.conditions` | `DiscourseNodeQueryBuilder` + `ResultsView` | ✅ DONE |

**New component:** `components/DiscourseNodeQueryBuilder.tsx`
- Uses `DiscourseNodeQueryEditor` for condition editing (with `settingKeys={["index", "conditions"]}`)
- Uses existing `ResultsView` with `preventSavingSettings={true}`
- Stores conditions in block props, not Roam blocks

### Tab 3: Format (`NodeConfig.tsx` + `DiscourseNodeSpecification.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Format | `format` | `ValidatedInputPanel` + `useDebouncedBlockPropUpdater` | ✅ DONE |
| Specification enabled | derived from `specification[]` length | `Checkbox` + `getDiscourseNodeSetting` | ✅ DONE |
| Specification conditions | `specification[]` | `DiscourseNodeQueryEditor` | ✅ DONE |

**New component:** `components/DiscourseNodeQueryEditor.tsx`
- Mirrors QueryEditor UI but uses block props for persistence
- Stores conditions as JSON array in `specification` block prop
- Supports clause, not, or, not or condition types
- No Roam block operations

### Tab 4: Template (`NodeConfig.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Template | `template` | `BlocksPanel` (roamjs) | ❌ NOT MIGRATED |

### Tab 5: Attributes (`DiscourseNodeAttributes.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Attributes | `attributes` | Custom CRUD + `getDiscourseNodeSetting`/`setDiscourseNodeSetting` | ✅ DONE |
| Overlay | `overlay` | `HTMLSelect` + `getDiscourseNodeSetting`/`setDiscourseNodeSetting` | ✅ DONE |

### Tab 6: Canvas (`DiscourseNodeCanvasSettings.tsx` + `NodeConfig.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Color | `canvasSettings.color` | `InputGroup` type=color + `setDiscourseNodeSetting` | ✅ DONE |
| Display Alias | `canvasSettings.alias` | `InputGroup` + `setDiscourseNodeSetting` | ✅ DONE |
| Key Image | `canvasSettings.key-image` | `Checkbox` + `setDiscourseNodeSetting` | ✅ DONE |
| Key Image Option | `canvasSettings.key-image-option` | `RadioGroup` + `setDiscourseNodeSetting` | ✅ DONE |
| Query Builder Alias | `canvasSettings.query-builder-alias` | `InputGroup` + `setDiscourseNodeSetting` | ✅ DONE |
| Graph Overview | `graphOverview` | `DiscourseNodeFlagPanel` | ✅ DONE |

### Tab 7: Suggestive Mode (`DiscourseNodeSuggestiveRules.tsx`)

| Setting | Schema Key | UI Component | Migration Status |
|---------|-----------|--------------|------------------|
| Template | `suggestiveRules.template` | `BlocksPanel` (roamjs) | ❌ NOT MIGRATED |
| Embedding Block Ref | `embeddingRef` | `InputGroup` + `setDiscourseNodeSetting` | ✅ DONE |
| First Child | `isFirstChild.value` | `DiscourseNodeFlagPanel` | ✅ DONE |

### Summary

| Category | Done | Pending |
|----------|------|---------|
| General | 3/3 | 0 |
| Index | 1/1 | 0 |
| Format | 3/3 | 0 |
| Template | 0/1 | 1 |
| Attributes | 2/2 | 0 |
| Canvas | 6/6 | 0 |
| Suggestive Mode | 2/3 | 1 (template) |
| **TOTAL** | **17/19** | **2** |

### Pending Items (Discourse Node)

1. **`template`** - `NodeConfig.tsx` - Uses BlocksPanel
2. **`suggestiveRules.template`** - `DiscourseNodeSuggestiveRules.tsx` - Uses BlocksPanel

---

## Full Migration Pending List

### 1. Discourse Node Settings (BlocksPanel - deferred)
| File | Setting | Old Component | Status |
|------|---------|---------------|--------|
| `NodeConfig.tsx` | `template` | `BlocksPanel` | ❌ |
| `DiscourseNodeSuggestiveRules.tsx` | `suggestiveRules.template` | `BlocksPanel` | ❌ |

### 2. Left Sidebar Global Settings
| File | Setting | Schema Key | Old Component | Status |
|------|---------|------------|---------------|--------|
| `LeftSidebarGlobalSettings.tsx` | Collapsable | `Global.Left Sidebar.Settings.Collapsable` | `FlagPanel` (roamjs) | ❌ |
| `LeftSidebarGlobalSettings.tsx` | Folded | `Global.Left Sidebar.Settings.Folded` | `FlagPanel` (roamjs) | ❌ |

### 3. Left Sidebar Personal Settings
| File | Setting | Schema Key | Old Component | Status |
|------|---------|------------|---------------|--------|
| `LeftSidebarPersonalSettings.tsx` | Alias | `Personal.Left Sidebar.[section].Children.[item].Alias` | `TextPanel` (roamjs) | ❌ |
| `LeftSidebarPersonalSettings.tsx` | Truncate-result? | `Personal.Left Sidebar.[section].Settings.Truncate-result?` | `NumberPanel` (roamjs) | ❌ |

### 4. Core Utils Using `discourseConfigRef` (larger migration)
| File | Usage | Status |
|------|-------|--------|
| `getDiscourseNodes.ts` | Reads node config from old tree | ❌ |
| `getDiscourseRelations.ts` | Reads relation config from old tree | ❌ |
| `isFlagEnabled.ts` | Checks feature flags | ❌ |
| `refreshConfigTree.ts` | Refreshes old config | ❌ |

### 5. Components Using `discourseConfigRef` (depends on #4)
| File | Status |
|------|--------|
| `LeftSidebarGlobalSettings.tsx` | ❌ |
| `LeftSidebarPersonalSettings.tsx` | ❌ |
| `SuggestiveModeSettings.tsx` | ❌ |
| `Settings.tsx` | ❌ |
| `LeftSidebarView.tsx` | ❌ |
| `SuggestionsBody.tsx` | ❌ |

### Migration Summary

| Category | Count | Status |
|----------|-------|--------|
| BlocksPanel (templates) | 2 | Deferred |
| Left Sidebar Global | 2 | ❌ |
| Left Sidebar Personal | 2 | ❌ |
| Core Utils (`discourseConfigRef`) | 4 | ❌ |
| Components (`discourseConfigRef`) | 6 | ❌ |
| **TOTAL PENDING** | **16** | |

