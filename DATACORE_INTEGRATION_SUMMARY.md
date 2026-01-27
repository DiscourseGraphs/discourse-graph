# Datacore NPM Package Integration - Summary

## Issue: ENG-1269

### Problem
Previously, users had to install datacore as a separate plugin from the Obsidian Community Plugin browser, then use it as a dependency in our Discourse Graphs plugin. This created an unnecessary installation step and dependency management issue.

### Solution Implemented
Successfully integrated the datacore npm package (`@blacksmithgu/datacore@0.1.24`) directly into the Obsidian Discourse Graphs plugin, eliminating the need for users to install datacore separately.

## Changes Made

### 1. Package Installation
- Added `@blacksmithgu/datacore` version `^0.1.24` as a dependency in `apps/obsidian/package.json`
- The package is now bundled directly into the plugin (21MB main.js includes datacore)

### 2. QueryEngine Refactoring (`apps/obsidian/src/services/QueryEngine.ts`)

#### Before:
- Used plugin registry workaround to access datacore API
- Had to check if datacore plugin was installed
- Used type assertions and unsafe `any` types

#### After:
- Direct import and usage of datacore API: `import { Datacore, DatacoreApi, Settings } from "@blacksmithgu/datacore"`
- Proper initialization flow with async event handling
- Added default datacore settings configuration
- Implemented robust error handling and fallback mechanisms

### Key Implementation Details:

1. **Datacore Initialization**
   - Creates `Datacore` instance with app, version, and settings
   - Uses event-driven initialization pattern
   - Listens for 'initialized' event to know when datacore is ready
   - Includes 10-second timeout with fallback to vault scanning

2. **Async Query Pattern**
   - All query methods now call `ensureInitialized()` before executing
   - Gracefully falls back to vault iteration if datacore fails to initialize

3. **Cleanup Method**
   - Added `cleanup()` method to properly unload datacore
   - Can be called from plugin's `onunload()` lifecycle method

4. **Fallback Strategy**
   - If datacore fails to initialize or times out, falls back to vault scanning
   - Ensures plugin functionality even if datacore has issues

## Testing

### Build Verification
✅ Build completed successfully with 0 errors
```bash
cd apps/obsidian && pnpm run build
# Output: built with 0 errors
```

### Linting
✅ No lint errors in QueryEngine.ts or any source files
- Only warnings in script files (pre-existing)

### Bundle Verification
✅ Datacore successfully bundled into main.js
- Output size: 21MB (includes datacore library)
- DatacoreApi confirmed present in bundle

## How to Use

### For Users
Users no longer need to:
1. Install datacore from Community Plugin browser
2. Manage datacore plugin separately

They simply:
1. Install the Discourse Graphs plugin
2. All datacore functionality is included automatically

### For Developers
To rebuild:
```bash
cd apps/obsidian
pnpm install
pnpm run build
```

The built plugin will be in `apps/obsidian/dist/`

## API Usage Example

```typescript
import { QueryEngine } from "~/services/QueryEngine";

// In your component or service
const queryEngine = new QueryEngine(app);

// Use query methods (they handle initialization automatically)
const results = await queryEngine.searchDiscourseNodesByTitle("search term");

// Cleanup when done (e.g., in onunload)
queryEngine.cleanup();
```

## Benefits

1. **Simplified Installation**: Users don't need to install multiple plugins
2. **Better Reliability**: No dependency on external plugin being installed
3. **Version Control**: We control which version of datacore is used
4. **Better Bundling**: Single plugin with all dependencies included
5. **Type Safety**: Direct TypeScript imports with full type information

## Potential Future Improvements

1. Consider lazy-loading datacore to reduce initial bundle size
2. Add progress indicator during datacore initialization
3. Implement more granular error recovery
4. Add metrics/telemetry for initialization success rates

## Notes

- The integration uses datacore's library export, not the plugin version
- Default settings are configured to balance performance and functionality
- Fallback mechanisms ensure the plugin works even if datacore initialization fails
- The bundled size increase (21MB) is acceptable for the improved user experience
