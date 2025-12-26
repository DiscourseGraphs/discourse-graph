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
} from "~/components/settings/block-prop/utils/zodSchema";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getBlockPropBasedSettings = ({
  keys,
}: {
  keys: string[];
}): { blockProps: json | undefined; blockUid: string } => {
  if (keys.length === 0) {
    console.warn("Attempting to get block prop with no keys");
    return { blockProps: undefined, blockUid: "" };
  }

  const sectionKey = keys[0];

  const blockUid = getBlockUidByTextOnPage({
    text: sectionKey,
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  const allBlockPropsForSection = getBlockProps(blockUid);

  if (keys.length > 1) {
    const propertyPath = keys.slice(1);

    const targetValue = propertyPath.reduce(
      (currentContext: json, currentKey) => {
        if (
          currentContext &&
          typeof currentContext === "object" &&
          !Array.isArray(currentContext)
        ) {
          const value = (currentContext as Record<string, json>)[currentKey];
          return value === undefined ? null : value;
        }
        return null;
      },
      allBlockPropsForSection,
    );
    return {
      blockProps: targetValue === null ? undefined : targetValue,
      blockUid,
    };
  }
  return { blockProps: allBlockPropsForSection, blockUid };
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

  if (keys.length === 1) {
    setBlockProps(blockUid, value as Record<string, json>, false);
    return;
  }

  const currentProps = getBlockProps(blockUid);
  const updatedProps = JSON.parse(JSON.stringify(currentProps || {})) as Record<
    string,
    json
  >;

  const propertyPath = keys.slice(1);
  const lastKeyIndex = propertyPath.length - 1;

  propertyPath.reduce<Record<string, json>>(
    (currentContext, currentKey, index) => {
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
    },
    updatedProps,
  );

  setBlockProps(blockUid, updatedProps, false);
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
