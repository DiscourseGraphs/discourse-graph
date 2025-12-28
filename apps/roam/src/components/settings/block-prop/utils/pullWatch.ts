import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import { type json, normalizeProps } from "~/utils/getBlockProps";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";
import { DiscourseNodeSchema } from "~/components/settings/block-prop/utils/zodSchema";

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

export type DiscourseNodeChangeCallback = (
  nodeType: string,
  settings: ReturnType<typeof DiscourseNodeSchema.parse>,
) => void;

type PullWatchCallback = (before: unknown, after: unknown) => void;

export const setupPullWatchDiscourseNodes = (
  nodePageUids: Record<string, string>,
  onNodeChange: DiscourseNodeChangeCallback,
): (() => void) => {
  const watches: Array<{ pattern: string; entityId: string; callback: PullWatchCallback }> = [];

  Object.entries(nodePageUids).forEach(([nodeType, pageUid]) => {
    const pattern = "[:block/props]";
    const entityId = `[:block/uid "${pageUid}"]`;
    const callback: PullWatchCallback = (before, after) => {
      if (hasPropChanged(before, after)) {
        const afterProps = getNormalizedProps(after);
        const settings = DiscourseNodeSchema.parse(afterProps);
        onNodeChange(nodeType, settings);
      }
    };

    window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
    watches.push({ pattern, entityId, callback });
  });

  return () => {
    watches.forEach(({ pattern, entityId, callback }) => {
      window.roamAlphaAPI.data.removePullWatch(pattern, entityId, callback);
    });
  };
};
