import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/data/blockPropsSettingsConfig";

export const setupPullWatchBlockPropsBasedSettings = (
  blockUids: Record<string, string>,
) => {
  const featureFlagsBlockUid =
    blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];

  if (featureFlagsBlockUid) {
    window.roamAlphaAPI.data.addPullWatch(
      "[:block/props]",
      `[:block/uid "${featureFlagsBlockUid}"]`,
      (before, after) => {
        console.log("feature flags changed", before, after);
      },
    );
  }
};
