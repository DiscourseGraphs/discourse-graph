import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import { type json, normalizeProps } from "~/utils/getBlockProps";

export const setupPullWatchBlockPropsBasedSettings = (
  blockUids: Record<string, string>,
  updateLeftSidebar: (container: HTMLDivElement) => void,
  leftSidebarContainer: HTMLDivElement,
) => {
  const featureFlagsBlockUid =
    blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];

  const globalSettingsBlockUid = blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.global];

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

        const beforeEnabled = beforeProps["Enable Left Sidebar"] as
          | boolean
          | undefined;
        const afterEnabled = afterProps["Enable Left Sidebar"] as
          | boolean
          | undefined;

        // Only update if the flag actually changed
        if (beforeEnabled !== afterEnabled) {
          updateLeftSidebar(leftSidebarContainer);
        }
      },
    );
  }

  if (globalSettingsBlockUid) {
    window.roamAlphaAPI.data.addPullWatch(
      "[:block/props]",
      `[:block/uid "${globalSettingsBlockUid}"]`,
      () => {
        updateLeftSidebar(leftSidebarContainer);
      },
    );
  }
};
