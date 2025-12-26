import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import { type json, normalizeProps } from "~/utils/getBlockProps";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";

const hasPropChanged = (
  before: unknown,
  after: unknown,
  key: string,
): boolean => {
  const beforeProps = normalizeProps(
    ((before as Record<string, unknown>)?.[":block/props"] || {}) as json,
  ) as Record<string, json>;
  const afterProps = normalizeProps(
    ((after as Record<string, unknown>)?.[":block/props"] || {}) as json,
  ) as Record<string, json>;

  return JSON.stringify(beforeProps[key]) !== JSON.stringify(afterProps[key]);
};

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
        if (hasPropChanged(before, after, "Enable Left Sidebar")) {
          updateLeftSidebar(leftSidebarContainer);
        }
      },
    );
  }

  if (globalSettingsBlockUid) {
    window.roamAlphaAPI.data.addPullWatch(
      "[:block/props]",
      `[:block/uid "${globalSettingsBlockUid}"]`,
      (before, after) => {
        if (hasPropChanged(before, after, "Left Sidebar")) {
          updateLeftSidebar(leftSidebarContainer);
        }
      },
    );
  }

  const personalSettingsKey = getPersonalSettingsKey();
  const personalSettingsBlockUid = blockUids[personalSettingsKey];

  if (personalSettingsBlockUid) {
    window.roamAlphaAPI.data.addPullWatch(
      "[:block/props]",
      `[:block/uid "${personalSettingsBlockUid}"]`,
      (before, after) => {
        if (hasPropChanged(before, after, "Left Sidebar")) {
          updateLeftSidebar(leftSidebarContainer);
        }
      },
    );
  }
};
