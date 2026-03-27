import { type json, normalizeProps } from "~/utils/getBlockProps";
import type { AddPullWatch, PullBlock } from "roamjs-components/types";
import {
  TOP_LEVEL_BLOCK_PROP_KEYS,
  getPersonalSettingsKey,
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  type FeatureFlags,
  type GlobalSettings,
  type PersonalSettings,
  type DiscourseNodeSettings,
} from "./zodSchema";
import { emitSettingChange, settingKeys } from "./settingsEmitter";
import { invalidateSettingsAccessorCaches } from "./accessors";

type PullWatchCallback = Parameters<AddPullWatch>[2];

// Need assertions to bridge type defs between the (roamjs-components) and json type (getBlockProps.ts)
const getNormalizedProps = (data: PullBlock | null): Record<string, json> => {
  return normalizeProps((data?.[":block/props"] || {}) as json) as Record<
    string,
    json
  >;
};

const hasPropChanged = (
  before: PullBlock | null,
  after: PullBlock | null,
  key?: string,
): boolean => {
  const beforeProps = getNormalizedProps(before);
  const afterProps = getNormalizedProps(after);

  if (key) {
    return JSON.stringify(beforeProps[key]) !== JSON.stringify(afterProps[key]);
  }

  return JSON.stringify(beforeProps) !== JSON.stringify(afterProps);
};

const createCleanupFn = (watches: Parameters<AddPullWatch>[]): (() => void) => {
  return () => {
    watches.forEach(([pattern, entityId, callback]) => {
      window.roamAlphaAPI.data.removePullWatch(pattern, entityId, callback);
    });
  };
};

const createSettingsWatchCallback = <T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T } },
  onSettingsChange: (context: {
    newSettings: T;
    oldSettings: T | null;
    before: PullBlock | null;
    after: PullBlock | null;
  }) => void,
): PullWatchCallback => {
  return (before, after) => {
    const beforeProps = getNormalizedProps(before);
    const afterProps = getNormalizedProps(after);
    const beforeResult = schema.safeParse(beforeProps);
    const afterResult = schema.safeParse(afterProps);

    if (!afterResult.success) return;

    invalidateSettingsAccessorCaches();

    const oldSettings = beforeResult.success
      ? (beforeResult.data ?? null)
      : null;
    const newSettings = afterResult.data as T;

    onSettingsChange({ newSettings, oldSettings, before, after });
  };
};

const addPullWatch = (
  watches: Parameters<AddPullWatch>[],
  blockUid: string,
  callback: PullWatchCallback,
): void => {
  const pattern = "[:block/props]";
  const entityId = `[:block/uid "${blockUid}"]`;

  window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
  watches.push([pattern, entityId, callback]);
};

export const featureFlagHandlers: Partial<
  Record<
    keyof FeatureFlags,
    (newValue: boolean, oldValue: boolean, allFlags: FeatureFlags) => void
  >
> = {
  /* eslint-disable @typescript-eslint/naming-convention */
  "Enable left sidebar": (newValue, oldValue) => {
    emitSettingChange(settingKeys.leftSidebarFlag, newValue, oldValue);
  },
  "Suggestive mode enabled": (newValue, oldValue) => {
    emitSettingChange(settingKeys.suggestiveModeEnabled, newValue, oldValue);
  },
  /* eslint-enable @typescript-eslint/naming-convention */
};

type GlobalSettingsHandlers = {
  [K in keyof GlobalSettings]?: (
    newValue: GlobalSettings[K],
    oldValue: GlobalSettings[K],
    allSettings: GlobalSettings,
  ) => void;
};

export const globalSettingsHandlers: GlobalSettingsHandlers = {
  /* eslint-disable @typescript-eslint/naming-convention */
  "Left sidebar": (newValue, oldValue) => {
    emitSettingChange(settingKeys.globalLeftSidebar, newValue, oldValue);
  },
  Trigger: (newValue, oldValue) => {
    emitSettingChange(settingKeys.globalTrigger, newValue, oldValue);
  },
  /* eslint-enable @typescript-eslint/naming-convention */
};

type PersonalSettingsHandlers = {
  [K in keyof PersonalSettings]?: (
    newValue: PersonalSettings[K],
    oldValue: PersonalSettings[K],
    allSettings: PersonalSettings,
  ) => void;
};

export const personalSettingsHandlers: PersonalSettingsHandlers = {
  /* eslint-disable @typescript-eslint/naming-convention */
  "Left sidebar": (newValue, oldValue) => {
    emitSettingChange(settingKeys.personalLeftSidebar, newValue, oldValue);
  },
  "Personal node menu trigger": (newValue, oldValue) => {
    emitSettingChange(settingKeys.personalNodeMenuTrigger, newValue, oldValue);
  },
  "Node search menu trigger": (newValue, oldValue) => {
    emitSettingChange(settingKeys.nodeSearchMenuTrigger, newValue, oldValue);
  },
  "Suggestive mode overlay": (newValue, oldValue) => {
    emitSettingChange(
      settingKeys.personalSuggestiveModeOverlay,
      newValue,
      oldValue,
    );
  },
  /* eslint-enable @typescript-eslint/naming-convention */
};

export const discourseNodeHandlers: Array<
  (
    nodeType: string,
    newSettings: DiscourseNodeSettings,
    oldSettings: DiscourseNodeSettings | null,
  ) => void
> = [
  // Add handlers as needed:
  // (nodeType, newSettings, oldSettings) => { ... },
];

export const setupPullWatchOnSettingsPage = (
  blockUids: Record<string, string>,
): (() => void) => {
  const watches: Parameters<AddPullWatch>[] = [];

  const featureFlagsBlockUid =
    blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];
  const globalSettingsBlockUid = blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.global];
  const personalSettingsKey = getPersonalSettingsKey();
  const personalSettingsBlockUid = blockUids[personalSettingsKey];

  if (featureFlagsBlockUid && Object.keys(featureFlagHandlers).length > 0) {
    addPullWatch(
      watches,
      featureFlagsBlockUid,
      createSettingsWatchCallback(
        FeatureFlagsSchema,
        ({ newSettings, oldSettings, before, after }) => {
          for (const [key, handler] of Object.entries(featureFlagHandlers)) {
            const typedKey = key as keyof FeatureFlags;
            if (hasPropChanged(before, after, key) && handler) {
              handler(
                newSettings[typedKey],
                oldSettings?.[typedKey] ?? false,
                newSettings,
              );
            }
          }
        },
      ),
    );
  }

  if (
    globalSettingsBlockUid &&
    Object.keys(globalSettingsHandlers).length > 0
  ) {
    addPullWatch(
      watches,
      globalSettingsBlockUid,
      createSettingsWatchCallback(
        GlobalSettingsSchema,
        ({ newSettings, oldSettings, before, after }) => {
          for (const [key, handler] of Object.entries(globalSettingsHandlers)) {
            const typedKey = key as keyof GlobalSettings;
            if (hasPropChanged(before, after, key) && handler) {
              // Object.entries loses key-handler correlation, but data is Zod-validated
              (
                handler as (
                  newValue: unknown,
                  oldValue: unknown,
                  allSettings: GlobalSettings,
                ) => void
              )(newSettings[typedKey], oldSettings?.[typedKey], newSettings);
            }
          }
        },
      ),
    );
  }

  if (
    personalSettingsBlockUid &&
    Object.keys(personalSettingsHandlers).length > 0
  ) {
    addPullWatch(
      watches,
      personalSettingsBlockUid,
      createSettingsWatchCallback(
        PersonalSettingsSchema,
        ({ newSettings, oldSettings, before, after }) => {
          for (const [key, handler] of Object.entries(
            personalSettingsHandlers,
          )) {
            const typedKey = key as keyof PersonalSettings;
            if (hasPropChanged(before, after, key) && handler) {
              // Object.entries loses key-handler correlation, but data is Zod-validated
              (
                handler as (
                  newValue: unknown,
                  oldValue: unknown,
                  allSettings: PersonalSettings,
                ) => void
              )(newSettings[typedKey], oldSettings?.[typedKey], newSettings);
            }
          }
        },
      ),
    );
  }

  return createCleanupFn(watches);
};

export const setupPullWatchDiscourseNodes = (
  nodePageUids: Record<string, string>,
): (() => void) => {
  const watches: Parameters<AddPullWatch>[] = [];

  if (discourseNodeHandlers.length === 0) {
    return () => {};
  }

  Object.entries(nodePageUids).forEach(([nodeType, pageUid]) => {
    addPullWatch(
      watches,
      pageUid,
      createSettingsWatchCallback(
        DiscourseNodeSchema,
        ({ newSettings, oldSettings }) => {
          for (const handler of discourseNodeHandlers) {
            handler(nodeType, newSettings, oldSettings);
          }
        },
      ),
    );
  });

  return createCleanupFn(watches);
};

export { getNormalizedProps, hasPropChanged };
