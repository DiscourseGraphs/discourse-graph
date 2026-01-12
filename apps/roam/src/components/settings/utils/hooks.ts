import { useState, useEffect } from "react";
import { getFeatureFlag } from "./accessors";
import type { FeatureFlags } from "./zodSchema";

const FEATURE_FLAG_CHANGE_EVENT = "discourse-graph:feature-flag-change";

type FeatureFlagChangeDetail = {
  key: keyof FeatureFlags;
  value: boolean;
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
