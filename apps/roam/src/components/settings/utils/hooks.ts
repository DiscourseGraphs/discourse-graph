import { useState, useEffect, useCallback } from "react";
import { getFeatureFlag, getGlobalSetting } from "./accessors";
import type { FeatureFlags, LeftSidebarGlobalSettings } from "./zodSchema";
import { LeftSidebarGlobalSettingsSchema } from "./zodSchema";
import type { json } from "~/utils/getBlockProps";

const FEATURE_FLAG_CHANGE_EVENT = "discourse-graph:feature-flag-change";
const GLOBAL_SETTING_CHANGE_EVENT = "discourse-graph:global-setting-change";

type FeatureFlagChangeDetail = {
  key: keyof FeatureFlags;
  value: boolean;
};

type GlobalSettingChangeDetail = {
  keys: string[];
  value: json;
};

export const emitFeatureFlagChange = (
  key: keyof FeatureFlags,
  value: boolean,
): void => {
  window.dispatchEvent(
    new CustomEvent<FeatureFlagChangeDetail>(FEATURE_FLAG_CHANGE_EVENT, {
      detail: { key, value },
    }),
  );
};

export const emitGlobalSettingChange = (keys: string[], value: json): void => {
  window.dispatchEvent(
    new CustomEvent<GlobalSettingChangeDetail>(GLOBAL_SETTING_CHANGE_EVENT, {
      detail: { keys, value },
    }),
  );
};

export const useFeatureFlag = (key: keyof FeatureFlags): boolean => {
  const [value, setValue] = useState(() => getFeatureFlag(key));

  useEffect(() => {
    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<FeatureFlagChangeDetail>;
      if (customEvent.detail.key === key) {
        setValue(customEvent.detail.value);
      }
    };

    window.addEventListener(FEATURE_FLAG_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener(FEATURE_FLAG_CHANGE_EVENT, handleChange);
    };
  }, [key]);

  return value;
};

export const useLeftSidebarGlobalSettings = (): LeftSidebarGlobalSettings => {
  const [settings, setSettings] = useState<LeftSidebarGlobalSettings>(() => {
    const raw = getGlobalSetting<LeftSidebarGlobalSettings>(["Left Sidebar"]);
    return LeftSidebarGlobalSettingsSchema.parse(raw ?? {});
  });

  const refreshSettings = useCallback(() => {
    const raw = getGlobalSetting<LeftSidebarGlobalSettings>(["Left Sidebar"]);
    setSettings(LeftSidebarGlobalSettingsSchema.parse(raw ?? {}));
  }, []);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalSettingChangeDetail>;
      if (customEvent.detail.keys[0] === "Left Sidebar") {
        refreshSettings();
      }
    };

    window.addEventListener(GLOBAL_SETTING_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener(GLOBAL_SETTING_CHANGE_EVENT, handleChange);
    };
  }, [refreshSettings]);

  return settings;
};
