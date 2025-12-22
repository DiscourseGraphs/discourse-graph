import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/data/blockPropsSettingsConfig";
import { json, normalizeProps } from "./getBlockProps";

export const setupPullWatchBlockPropsBasedSettings = (
  blockUids: Record<string, string>,
  updateLeftSidebar: (container: HTMLDivElement) => void,
  leftSidebarContainer: HTMLDivElement,
) => {
  const featureFlagsBlockUid =
    blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];

  if (featureFlagsBlockUid) {
    window.roamAlphaAPI.data.addPullWatch(
      "[:block/props]",
      `[:block/uid "${featureFlagsBlockUid}"]`,
      (before, after) => {
        const beforeProps = normalizeProps(
          (before?.[":block/props"] || {}) as json,
        ) as Record<string, json>;
        const afterProps = normalizeProps(
          (after?.[":block/props"] || {}) as json,
        ) as Record<string, json>;

        const beforeEnabled = beforeProps["Enable Left sidebar"] as
          | boolean
          | undefined;
        const afterEnabled = afterProps["Enable Left sidebar"] as
          | boolean
          | undefined;

        // Only update if the flag actually changed
        if (beforeEnabled !== afterEnabled) {
          updateLeftSidebar(leftSidebarContainer);
        }
      },
    );
  }
};
