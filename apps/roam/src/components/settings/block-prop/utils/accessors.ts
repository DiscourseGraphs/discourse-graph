import getBlockProps, { type json } from "~/utils/getBlockProps";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import setBlockProps from "~/utils/setBlockProps";
import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  TOP_LEVEL_BLOCK_PROP_KEYS,
} from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import z from "zod";
import {
  FeatureFlags,
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  DiscourseNodeSettings,
} from "~/components/settings/block-prop/utils/zodSchema";
import {
  getPersonalSettingsKey,
  getDiscourseNodePageUid,
  DISCOURSE_NODE_PAGE_PREFIX,
} from "~/components/settings/block-prop/utils/init";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getBlockPropsByUid = (
  blockUid: string,
  keys: string[],
): json | undefined => {
  const allBlockProps = getBlockProps(blockUid);

  if (keys.length === 0) {
    return allBlockProps;
  }

  const targetValue = keys.reduce((currentContext: json, currentKey) => {
    if (
      currentContext &&
      typeof currentContext === "object" &&
      !Array.isArray(currentContext)
    ) {
      const value = (currentContext as Record<string, json>)[currentKey];
      return value === undefined ? null : value;
    }
    return null;
  }, allBlockProps);

  return targetValue === null ? undefined : targetValue;
};

export const setBlockPropsByUid = (
  blockUid: string,
  keys: string[],
  value: json,
): void => {
  if (keys.length === 0) {
    setBlockProps(blockUid, value as Record<string, json>, false);
    return;
  }

  const currentProps = getBlockProps(blockUid);
  const updatedProps = JSON.parse(JSON.stringify(currentProps || {})) as Record<
    string,
    json
  >;

  const lastKeyIndex = keys.length - 1;

  keys.reduce<Record<string, json>>((currentContext, currentKey, index) => {
    if (index === lastKeyIndex) {
      currentContext[currentKey] = value;
      return currentContext;
    }

    if (
      !currentContext[currentKey] ||
      typeof currentContext[currentKey] !== "object" ||
      Array.isArray(currentContext[currentKey])
    ) {
      currentContext[currentKey] = {};
    }

    return currentContext[currentKey] as Record<string, json>;
  }, updatedProps);

  setBlockProps(blockUid, updatedProps, false);
};

export const getBlockPropBasedSettings = ({
  keys,
}: {
  keys: string[];
}): { blockProps: json | undefined; blockUid: string } => {
  if (keys.length === 0) {
    console.warn("Attempting to get block prop with no keys");
    return { blockProps: undefined, blockUid: "" };
  }

  const blockUid = getBlockUidByTextOnPage({
    text: keys[0],
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  const blockProps = getBlockPropsByUid(blockUid, keys.slice(1));

  return { blockProps, blockUid };
};

export const setBlockPropBasedSettings = ({
  keys,
  value,
}: {
  keys: string[];
  value: json;
}) => {
  if (keys.length === 0) {
    console.warn("Attempting to set block prop with no keys");
    return;
  }

  const blockUid = getBlockUidByTextOnPage({
    text: keys[0],
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  setBlockPropsByUid(blockUid, keys.slice(1), value);
};

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

  const validatedValue = z.boolean().parse(value);

  void setBlockPropBasedSettings({
    keys: [featureFlagKey, key],
    value: validatedValue,
  });
};

export const getGlobalSetting = (keys: string[]): unknown => {
  const globalKey = TOP_LEVEL_BLOCK_PROP_KEYS.global;

  const { blockProps } = getBlockPropBasedSettings({
    keys: [globalKey],
  });

  const settings = GlobalSettingsSchema.parse(blockProps || {});

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings);
};

export const setGlobalSetting = (keys: string[], value: json): void => {
  const globalKey = TOP_LEVEL_BLOCK_PROP_KEYS.global;

  void setBlockPropBasedSettings({
    keys: [globalKey, ...keys],
    value,
  });
};

export const getPersonalSetting = (keys: string[]): unknown => {
  const personalKey = getPersonalSettingsKey();

  const { blockProps } = getBlockPropBasedSettings({
    keys: [personalKey],
  });

  const settings = PersonalSettingsSchema.parse(blockProps || {});

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings);
};

export const setPersonalSetting = (keys: string[], value: json): void => {
  const personalKey = getPersonalSettingsKey();

  void setBlockPropBasedSettings({
    keys: [personalKey, ...keys],
    value,
  });
};

export const getDiscourseNodeSettings = (
  nodeType: string,
): DiscourseNodeSettings | undefined => {
  // nodeType is already the page UID for discourse-graph/nodes/* pages
  // Try using it directly first, then fall back to looking up by title
  let pageUid = nodeType;

  // Check if this UID exists by trying to get props
  let blockProps = getBlockPropsByUid(pageUid, []);

  // If not found, try looking up by page title (for default nodes like _CLM-node)
  if (!blockProps) {
    const lookedUpUid = getDiscourseNodePageUid(nodeType);
    if (lookedUpUid) {
      pageUid = lookedUpUid;
      blockProps = getBlockPropsByUid(pageUid, []);
    }
  }

  console.log(`[DG:accessor] getDiscourseNodeSettings(${nodeType}) - pageUid: ${pageUid}, blockProps:`, blockProps);

  if (!blockProps) return undefined;

  const result = DiscourseNodeSchema.safeParse(blockProps);
  if (!result.success) {
    console.warn(`[DG:accessor] getDiscourseNodeSettings(${nodeType}) - parse failed:`, result.error);
    return undefined;
  }
  console.log(`[DG:accessor] getDiscourseNodeSettings(${nodeType}) - parsed:`, result.data);
  return result.data;
};

export const getDiscourseNodeSetting = (
  nodeType: string,
  keys: string[],
): unknown => {
  const settings = getDiscourseNodeSettings(nodeType);

  if (!settings) return undefined;

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings);
};

export const setDiscourseNodeSetting = (
  nodeType: string,
  keys: string[],
  value: json,
): void => {
  // nodeType is already the page UID for discourse-graph/nodes/* pages
  const pageUid = nodeType;

  console.log(`[DG:accessor] setDiscourseNodeSetting(${nodeType}) - pageUid: ${pageUid}, keys: ${JSON.stringify(keys)}, value:`, value);

  setBlockPropsByUid(pageUid, keys, value);
};

export const getAllDiscourseNodes = (): DiscourseNodeSettings[] => {
  const results = window.roamAlphaAPI.q(`
    [:find ?uid ?title
     :where
     [?page :node/title ?title]
     [?page :block/uid ?uid]
     [(clojure.string/starts-with? ?title "${DISCOURSE_NODE_PAGE_PREFIX}")]]
  `) as [string, string][];

  const nodes: DiscourseNodeSettings[] = [];

  for (const [pageUid, title] of results) {
    const blockProps = getBlockPropsByUid(pageUid, []);
    if (!blockProps) continue;

    const result = DiscourseNodeSchema.safeParse(blockProps);
    if (result.success) {
      nodes.push({
        ...result.data,
        type: pageUid,
        text: title.replace(DISCOURSE_NODE_PAGE_PREFIX, ""),
      });
    }
  }

  return nodes;
};
