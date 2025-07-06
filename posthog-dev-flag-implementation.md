# PostHog Dev Flag Implementation

## Overview

This document describes the implementation of a development flag for PostHog to ensure that analytics events are only sent in production environments, not in development environments.

## Changes Made

### 1. Website App (`apps/website/app/providers.tsx`)

**Before:**
```typescript
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      capture_pageview: false,
    });
  }, []);
  // ...
}
```

**After:**
```typescript
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize PostHog in production
    if (process.env.NODE_ENV === "production") {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        capture_pageview: false,
      });
    }
  }, []);
  // ...
}
```

**Effect:** PostHog will only initialize in production. The `PostHogPageView` component will automatically handle the case where PostHog is not initialized (it checks if `posthog` exists before capturing events).

### 2. Roam App PostHog Utility (`apps/roam/src/utils/posthog.ts`)

Created a new utility file that wraps all PostHog functionality with production checks:

```typescript
import posthog from "posthog-js";

/**
 * Wrapper for PostHog capture that only sends events in production
 */
export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  if (process.env.NODE_ENV === "production") {
    posthog.capture(eventName, properties);
  }
};

/**
 * Wrapper for PostHog identify that only runs in production
 */
export const identifyUser = (distinctId: string, properties?: Record<string, any>) => {
  if (process.env.NODE_ENV === "production") {
    posthog.identify(distinctId, properties);
  }
};

/**
 * Initialize PostHog only in production
 */
export const initPostHog = () => {
  if (process.env.NODE_ENV === "production") {
    posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      autocapture: false,
      property_denylist: [
        "$ip",
        "$device_id",
        "$geoip_city_name",
        "$geoip_latitude",
        "$geoip_longitude",
        "$geoip_postal_code",
        "$geoip_subdivision_1_name",
        "$raw_user_agent",
        "$current_url",
        "$referrer",
        "$referring_domain",
        "$initial_current_url",
        "$pathname",
      ],
    });
  }
};
```

### 3. Updated Roam App Main File (`apps/roam/src/index.ts`)

**Before:**
```typescript
import posthog from "posthog-js";

const initPostHog = () => {
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    // ... config
  });
};

// Later in the code:
if (!isEncrypted && !isOffline) {
  initPostHog();
  posthog.identify(userUid, { graphName });
  posthog.capture("Extension Loaded", { graphName, userUid });
}
```

**After:**
```typescript
import { initPostHog, captureEvent, identifyUser } from "./utils/posthog";

// Later in the code:
if (!isEncrypted && !isOffline) {
  initPostHog();
  identifyUser(userUid, { graphName });
  captureEvent("Extension Loaded", { graphName, userUid });
}
```

## Next Steps

To complete the implementation, the following files need to be updated to use the new PostHog utility functions:

### Files to Update

1. **`apps/roam/src/utils/createDiscourseNode.ts`**
   - Replace `posthog.capture` with `captureEvent`

2. **`apps/roam/src/components/QueryDrawer.tsx`**
   - Replace `posthog.capture` with `captureEvent`

3. **`apps/roam/src/components/QueryBuilder.tsx`**
   - Replace `posthog.capture` with `captureEvent`

4. **`apps/roam/src/components/ExportDiscourseContext.tsx`**
   - Replace `posthog.capture` with `captureEvent`

5. **`apps/roam/src/components/DiscourseNodeSearchMenu.tsx`**
   - Replace `posthog.capture` with `captureEvent`

6. **`apps/roam/src/components/DiscourseNodeMenu.tsx`**
   - Replace `posthog.capture` with `captureEvent`

7. **`apps/roam/src/components/DiscourseContext.tsx`**
   - Replace `posthog.capture` with `captureEvent`

8. **`apps/roam/src/components/results-view/ResultsView.tsx`**
   - Replace `posthog.capture` with `captureEvent`

9. **`apps/roam/src/components/settings/QueryPagesPanel.tsx`**
   - Replace `posthog.capture` with `captureEvent`

10. **`apps/roam/src/components/settings/DiscourseRelationConfigPanel.tsx`**
    - Replace `posthog.capture` with `captureEvent`

11. **`apps/roam/src/components/canvas/Tldraw.tsx`**
    - Replace `posthog.capture` with `captureEvent`

12. **`apps/roam/src/components/settings/DiscourseNodeConfigPanel.tsx`**
    - Replace `posthog.capture` with `captureEvent`

13. **`apps/roam/src/components/canvas/DiscourseNodeUtil.tsx`**
    - Replace `posthog.capture` with `captureEvent`

14. **`apps/roam/src/components/canvas/CanvasDrawer.tsx`**
    - Replace `posthog.capture` with `captureEvent`

### Update Pattern

For each file, make these changes:

1. **Replace the import:**
   ```typescript
   // Before:
   import posthog from "posthog-js";
   
   // After:
   import { captureEvent } from "~/utils/posthog";
   ```

2. **Replace capture calls:**
   ```typescript
   // Before:
   posthog.capture("Event Name", { properties });
   
   // After:
   captureEvent("Event Name", { properties });
   ```

## Testing

### Development Environment
- In development (`NODE_ENV !== "production"`), PostHog should not initialize
- No events should be sent to PostHog
- Console logs can be added to verify this behavior

### Production Environment
- PostHog should initialize normally
- All events should be captured as before
- Behavior should be identical to the previous implementation

## Benefits

1. **Clean Development**: No analytics noise in development environments
2. **Consistent Pattern**: All PostHog usage follows the same pattern
3. **Centralized Control**: Easy to modify PostHog behavior from one place
4. **Maintainable**: Clear separation of concerns

## Environment Variables

The implementation relies on `NODE_ENV` being set appropriately:
- **Development**: `NODE_ENV=development` (or anything other than "production")
- **Production**: `NODE_ENV=production`

This is already configured in the build scripts for both apps.