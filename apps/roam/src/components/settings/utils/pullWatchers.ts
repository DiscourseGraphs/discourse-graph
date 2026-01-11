import { type json, normalizeProps } from "~/utils/getBlockProps";
import {
  TOP_LEVEL_BLOCK_PROP_KEYS,
} from "../data/blockPropsSettingsConfig";
import { getPersonalSettingsKey } from "./init";
import {
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  type FeatureFlags,
  type GlobalSettings,
  type PersonalSettings,
  type DiscourseNodeSettings,
} from "./zodSchema";

type PullWatchCallback = (before: unknown, after: unknown) => void;

type PullWatchEntry = {
  pattern: string;
  entityId: string;
  callback: PullWatchCallback;
};

const getNormalizedProps = (data: unknown): Record<string, json> => {
  return normalizeProps(
    ((data as Record<string, unknown>)?.[":block/props"] || {}) as json,
  ) as Record<string, json>;
};

const hasPropChanged = (
  before: unknown,
  after: unknown,
  key?: string,
): boolean => {
  const beforeProps = getNormalizedProps(before);
  const afterProps = getNormalizedProps(after);

  if (key) {
    return JSON.stringify(beforeProps[key]) !== JSON.stringify(afterProps[key]);
  }

  return JSON.stringify(beforeProps) !== JSON.stringify(afterProps);
};

const createCleanupFn = (watches: PullWatchEntry[]): (() => void) => {
  return () => {
    watches.forEach(({ pattern, entityId, callback }) => {
      window.roamAlphaAPI.data.removePullWatch(pattern, entityId, callback);
    });
  };
};

const addPullWatch = (
  watches: PullWatchEntry[],
  blockUid: string,
  callback: PullWatchCallback,
): void => {
  const pattern = "[:block/props]";
  const entityId = `[:block/uid "${blockUid}"]`;

  window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
  watches.push({ pattern, entityId, callback });
};

type FeatureFlagHandler = (
  newValue: boolean,
  oldValue: boolean,
  allSettings: FeatureFlags,
) => void;

type GlobalSettingHandler<K extends keyof GlobalSettings = keyof GlobalSettings> = (
  newValue: GlobalSettings[K],
  oldValue: GlobalSettings[K],
  allSettings: GlobalSettings,
) => void;

type PersonalSettingHandler<K extends keyof PersonalSettings = keyof PersonalSettings> = (
  newValue: PersonalSettings[K],
  oldValue: PersonalSettings[K],
  allSettings: PersonalSettings,
) => void;

type DiscourseNodeHandler = (
  nodeType: string,
  newSettings: DiscourseNodeSettings,
  oldSettings: DiscourseNodeSettings | null,
) => void;

export const featureFlagHandlers: Partial<
  Record<keyof FeatureFlags, FeatureFlagHandler>
> = {
  // Add handlers as needed:
  // "Enable Left Sidebar": (newValue) => { ... },
  // "Suggestive Mode Enabled": (newValue) => { ... },
  // "Reified Relation Triples": (newValue) => { ... },
};

export const globalSettingsHandlers: Partial<
  Record<keyof GlobalSettings, GlobalSettingHandler>
> = {
  // Add handlers as needed:
  // "Trigger": (newValue) => { ... },
  // "Canvas Page Format": (newValue) => { ... },
  // "Left Sidebar": (newValue) => { ... },
  // "Export": (newValue) => { ... },
  // "Suggestive Mode": (newValue) => { ... },
};

export const personalSettingsHandlers: Partial<
  Record<keyof PersonalSettings, PersonalSettingHandler>
> = {
  // Add handlers as needed:
  // "Left Sidebar": (newValue) => { ... },
  // "Discourse Context Overlay": (newValue) => { ... },
  // "Page Preview": (newValue) => { ... },
  // etc.
};


export const discourseNodeHandlers: DiscourseNodeHandler[] = [
  // Add handlers as needed:
  // (nodeType, newSettings, oldSettings) => { ... },
];


export const setupPullWatchSettings = (
  blockUids: Record<string, string>,
): (() => void) => {
  const watches: PullWatchEntry[] = [];

  const featureFlagsBlockUid =
    blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];
  const globalSettingsBlockUid = blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.global];
  const personalSettingsKey = getPersonalSettingsKey();
  const personalSettingsBlockUid = blockUids[personalSettingsKey];

  if (featureFlagsBlockUid && Object.keys(featureFlagHandlers).length > 0) {
    addPullWatch(watches, featureFlagsBlockUid, (before, after) => {
      if (!hasPropChanged(before, after)) return;

      const beforeProps = getNormalizedProps(before);
      const afterProps = getNormalizedProps(after);
      const beforeResult = FeatureFlagsSchema.safeParse(beforeProps);
      const afterResult = FeatureFlagsSchema.safeParse(afterProps);

      if (!afterResult.success) return;

      const oldSettings = beforeResult.success ? beforeResult.data : null;
      const newSettings = afterResult.data;

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
    });
  }

  if (globalSettingsBlockUid && Object.keys(globalSettingsHandlers).length > 0) {
    addPullWatch(watches, globalSettingsBlockUid, (before, after) => {
      if (!hasPropChanged(before, after)) return;

      const beforeProps = getNormalizedProps(before);
      const afterProps = getNormalizedProps(after);
      const beforeResult = GlobalSettingsSchema.safeParse(beforeProps);
      const afterResult = GlobalSettingsSchema.safeParse(afterProps);

      if (!afterResult.success) return;

      const oldSettings = beforeResult.success ? beforeResult.data : null;
      const newSettings = afterResult.data;

      for (const [key, handler] of Object.entries(globalSettingsHandlers)) {
        const typedKey = key as keyof GlobalSettings;
        if (hasPropChanged(before, after, key) && handler) {
          handler(
            newSettings[typedKey],
            oldSettings?.[typedKey] as GlobalSettings[typeof typedKey],
            newSettings,
          );
        }
      }
    });
  }

  if (personalSettingsBlockUid && Object.keys(personalSettingsHandlers).length > 0) {
    addPullWatch(watches, personalSettingsBlockUid, (before, after) => {
      if (!hasPropChanged(before, after)) return;

      const beforeProps = getNormalizedProps(before);
      const afterProps = getNormalizedProps(after);
      const beforeResult = PersonalSettingsSchema.safeParse(beforeProps);
      const afterResult = PersonalSettingsSchema.safeParse(afterProps);

      if (!afterResult.success) return;

      const oldSettings = beforeResult.success ? beforeResult.data : null;
      const newSettings = afterResult.data;

      for (const [key, handler] of Object.entries(personalSettingsHandlers)) {
        const typedKey = key as keyof PersonalSettings;
        if (hasPropChanged(before, after, key) && handler) {
          handler(
            newSettings[typedKey],
            oldSettings?.[typedKey] as PersonalSettings[typeof typedKey],
            newSettings,
          );
        }
      }
    });
  }

  return createCleanupFn(watches);
};


export const setupPullWatchDiscourseNodes = (
  nodePageUids: Record<string, string>,
): (() => void) => {
  const watches: PullWatchEntry[] = [];

  if (discourseNodeHandlers.length === 0) {
    return () => {};
  }

  Object.entries(nodePageUids).forEach(([nodeType, pageUid]) => {
    addPullWatch(watches, pageUid, (before, after) => {
      if (!hasPropChanged(before, after)) return;

      const beforeProps = getNormalizedProps(before);
      const afterProps = getNormalizedProps(after);
      const beforeResult = DiscourseNodeSchema.safeParse(beforeProps);
      const afterResult = DiscourseNodeSchema.safeParse(afterProps);

      if (!afterResult.success) return;

      const oldSettings = beforeResult.success ? beforeResult.data : null;
      const newSettings = afterResult.data;

      for (const handler of discourseNodeHandlers) {
        handler(nodeType, newSettings, oldSettings);
      }
    });
  });

  return createCleanupFn(watches);
};


export { hasPropChanged, getNormalizedProps };
