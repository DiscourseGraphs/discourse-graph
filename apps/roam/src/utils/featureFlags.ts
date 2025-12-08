import { FeatureFlagsSchema, type FeatureFlags } from "./zodSchemaForSettings";
import {
  getBlockPropSettings,
  setBlockPropSettings,
  TOP_LEVEL_BLOCK_PROP_KEYS,
} from "./settingsUsingBlockProps";

export const featureFlagEnabled = ({
  key,
  value,
}: {
  key: keyof FeatureFlags;
  value?: boolean;
}): boolean => {
  const featureFlagKey = TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags;

  if (value !== undefined) {
    void setBlockPropSettings({ keys: [featureFlagKey, key], value });
    return value;
  }

  const { blockProps } = getBlockPropSettings({
    keys: [featureFlagKey],
  });

  const flags = FeatureFlagsSchema.parse(blockProps || {});

  return flags[key];
};
