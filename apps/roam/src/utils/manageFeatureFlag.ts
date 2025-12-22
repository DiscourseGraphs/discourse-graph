import { FeatureFlagsSchema, type FeatureFlags } from "./zodSchemaForSettings";
import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/data/blockPropsSettingsConfig";
import {
  setBlockPropBasedSettings,
  getBlockPropBasedSettings,
} from "~/utils/settingsUsingBlockProps";

export const getFeatureFlag = (key: keyof FeatureFlags): boolean => {
  const featureFlagKey = TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags;

  const { blockProps } = getBlockPropBasedSettings({
    keys: [featureFlagKey],
  });

  const flags = FeatureFlagsSchema.parse(blockProps || {});

  return flags[key];
};

export const setFeatureFlag = (
  key: keyof FeatureFlags,
  value: boolean,
): void => {
  const featureFlagKey = TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags;

  void setBlockPropBasedSettings({ keys: [featureFlagKey, key], value });
};
