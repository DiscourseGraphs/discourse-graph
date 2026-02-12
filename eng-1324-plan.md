# Per-Canvas Sync Mode Flag (Roam Canvas)

## Summary
Replace the current implicit sync heuristic (`new/empty canvas => sync`) with an explicit persisted per-canvas mode flag.  
Canvas mode will be determined only by that flag (`local` or `sync`), with a main menu toggle to change it.  
Default for canvases without a flag: `local`.  
V0 behavior when enabling sync: start from a new blank sync canvas (no auto import/seed).

## Public API / Interface Changes
1. **Canvas page props (`roamjs-query-builder`)**
   - Add `canvasSyncMode?: "local" | "sync"` under `:roamjs-query-builder`.
   - Effective mode rules:
     - If missing: treat as `"local"` and persist `"local"` on first canvas load.
     - If `"sync"`: use Cloudflare sync adapter.
     - If `"local"`: use Roam local adapter.
   - Remove behavioral dependency on `tldraw` presence/emptiness for mode selection.

## Implementation Plan
1. **Introduce canvas sync mode utilities**
   - Add a dedicated utility (e.g. `apps/roam/src/components/canvas/canvasSyncMode.ts`) for:
     - reading/writing `canvasSyncMode` from page props
     - returning effective mode with defaulting
     - ensuring initial persistence of default `"local"`
   - Keep prop access normalized via existing `getBlockProps`/`setBlockProps` helpers.

2. **Replace mode selection in canvas entrypoint**
   - Update `apps/roam/src/components/canvas/Tldraw.tsx`:
     - remove mode selection logic based on `hasRoamPersistedCanvasData(pageUid)`
     - select adapter solely by `canvasSyncMode` (+ existing global env guard for sync availability)
   - Keep existing `isCloudflareSync` rendering path, but source it from mode flag.

3. **Add sync mode toggle to main menu**
   - Update `apps/roam/src/components/canvas/uiOverrides.tsx`:
     - add a `TldrawUiMenuCheckboxItem` under `MainMenu` (View or a new Collaboration subgroup)
     - label: `Sync mode`
     - checked reflects current per-canvas mode
     - toggle handler persists mode for current canvas page
     - when toggled ON, always show a popup/toast notification: user is starting from a new blank sync canvas
   - If sync backend is unavailable (`TLDRAW_CLOUDFLARE_SYNC_ENABLED` false or URL missing), show disabled item with explanatory label.

4. **No import/seed in V0**
   - Do not attempt to copy local `roamjs-query-builder.tldraw` data into sync room.
   - Do not add worker seed endpoint in V0.
   - Sync ON simply opens the sync room as-is; for first-time rooms, this is a blank canvas.
   - Track auto-import/manual-import as a future enhancement.

5. **UI indicator for mixed-version clarity**
   - Keep and strengthen sync-on indicator in canvas UI (existing cloud badge area in `Tldraw.tsx`):
     - show when `canvasSyncMode === "sync"` (not based on heuristic)
     - tooltip text clarifies collaborators on older/non-realtime builds may still open local canvas behavior.
   - This addresses mixed-version behavior without introducing permission/role complexity.

6. **Cleanup**
   - Remove or repurpose `hasRoamPersistedCanvasData` so it no longer influences mode choice.
   - Ensure no code path flips mode implicitly due to data existence.

## Test Cases and Scenarios
1. **Mode persistence**
   - Open canvas with no flag -> mode resolves to local and persists `canvasSyncMode=local`.
   - Toggle ON -> `canvasSyncMode=sync` persisted.
   - Reload / open in new session / open as another user -> mode remains sync.

2. **No heuristic fallback**
   - Canvas with existing local `tldraw` data and `canvasSyncMode=sync` still opens sync adapter.
   - Canvas with empty data and `canvasSyncMode=local` still opens local adapter.

3. **V0 blank-sync behavior**
   - Toggle sync ON always shows popup/toast: user is starting from a new blank sync canvas.
   - No pre-check for existing local shapes is performed before showing this notification.
   - Local canvas data is not imported in V0.

4. **Main menu UX**
   - Toggle visible in main menu for current canvas.
   - Checked state matches persisted mode.
   - Disabled state shown when sync backend unavailable.

5. **Mixed-version indicator**
   - Sync mode ON always shows indicator.
   - Tooltip communicates possible collaborator mismatch (older build/local-only behavior).

6. **Regression checks**
   - Legacy canvas upgrade flow still works.
   - Local canvas save/remote pull-watch flow remains unchanged in local mode.

## Acceptance Criteria Mapping
- Per-canvas flag exists and is persisted: `canvasSyncMode`.
- Main menu toggle exists and updates current canvas mode.
- Mode selection uses flag only; no empty-canvas heuristic.
- Opening canvases with data no longer forces local mode.
- V0 sync toggle intentionally does not import local data.

## Assumptions and Defaults
- **Chosen default**: canvases without explicit mode default to and persist as `local`.
- **Chosen V0 toggle behavior**: enabling sync switches to sync room directly and shows a blank-canvas notification.
- No permissions model added for who can toggle.
- No broad historical migration job; old canvases are defaulted lazily on open.
- Existing global sync gate (`TLDRAW_CLOUDFLARE_SYNC_ENABLED` + URL) remains in place.
- Auto-import/manual import from local data is explicitly deferred to a later version.
