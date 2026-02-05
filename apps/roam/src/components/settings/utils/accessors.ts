import getBlockProps, {
  normalizeProps,
  type json,
} from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import internalError from "~/utils/internalError";
import { z } from "zod";

import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  DISCOURSE_NODE_PAGE_PREFIX,
  TOP_LEVEL_BLOCK_PROP_KEYS,
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  getPersonalSettingsKey,
  type FeatureFlags,
  type GlobalSettings,
  type PersonalSettings,
  type DiscourseNodeSettings,
  type DiscourseRelationSettings,
} from "./zodSchema";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  let didUnwrap = true;

  while (didUnwrap) {
    didUnwrap = false;

    if (current instanceof z.ZodDefault) {
      const defaultSchema = current as z.ZodDefault<z.ZodTypeAny>;
      current = defaultSchema._def.innerType;
      didUnwrap = true;
      continue;
    }

    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = current.unwrap() as z.ZodTypeAny;
      didUnwrap = true;
      continue;
    }

    if (current instanceof z.ZodEffects) {
      const effectsSchema = current as z.ZodEffects<z.ZodTypeAny>;
      current = effectsSchema._def.schema;
      didUnwrap = true;
      continue;
    }

    if (current instanceof z.ZodCatch) {
      const catchSchema = current as z.ZodCatch<z.ZodTypeAny>;
      current = catchSchema._def.innerType;
      didUnwrap = true;
      continue;
    }

    if (current instanceof z.ZodLazy) {
      const lazySchema = current as z.ZodLazy<z.ZodTypeAny>;
      current = lazySchema._def.getter();
      didUnwrap = true;
    }
  }

  return current;
};

const getSchemaAtPath = (
  schema: z.ZodTypeAny,
  keys: string[],
): z.ZodTypeAny | null => {
  let current = unwrapSchema(schema);

  for (const key of keys) {
    current = unwrapSchema(current);

    if (current instanceof z.ZodObject) {
      const shape = current.shape as Record<string, z.ZodTypeAny>;
      if (!(key in shape)) return null;
      current = shape[key];
      continue;
    }

    if (current instanceof z.ZodRecord) {
      current = current.valueSchema as z.ZodTypeAny;
      continue;
    }

    if (current instanceof z.ZodArray) {
      current = current.element as z.ZodTypeAny;
      continue;
    }

    return null;
  }

  return current;
};

const formatSettingPath = (keys: string[]): string =>
  keys.length === 0 ? "(root)" : keys.join(" > ");

const validateSettingValue = ({
  schema,
  keys,
  value,
  context,
}: {
  schema: z.ZodTypeAny;
  keys: string[];
  value: json;
  context: string;
}): boolean => {
  const targetSchema = getSchemaAtPath(schema, keys);

  if (!targetSchema) {
    internalError({
      error: `Unknown ${context} setting path: ${formatSettingPath(keys)}`,
      type: "DG Accessor",
      context: { keys },
    });
    return false;
  }

  const result = targetSchema.safeParse(value);

  if (!result.success) {
    internalError({
      error: `Invalid ${context} setting value at path: ${formatSettingPath(keys)}`,
      type: "DG Accessor",
      context: { keys, zodError: result.error.message },
    });
    return false;
  }

  return true;
};

const getBlockPropsByUid = (
  blockUid: string,
  keys: string[],
): json | undefined => {
  if (!blockUid) return undefined;

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
      const value = currentContext[currentKey];
      return value === undefined ? null : value;
    }
    return null;
  }, allBlockProps);

  return targetValue === null ? undefined : targetValue;
};

const setBlockPropAtPath = (
  blockUid: string,
  keys: string[],
  value: json,
): void => {
  if (!blockUid) {
    internalError({
      error: "setBlockPropAtPath called with empty blockUid",
      type: "DG Accessor",
    });
    return;
  }

  if (keys.length === 0) {
    internalError({
      error: "setBlockPropAtPath called with empty keys array",
      type: "DG Accessor",
    });
    return;
  }

  const currentProps = getBlockProps(blockUid);
  const updatedProps: Record<string, json> = currentProps || {};
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

    return currentContext[currentKey];
  }, updatedProps);

  setBlockProps(blockUid, updatedProps, false);
};

const getBlockPropBasedSettings = ({
  keys,
}: {
  keys: string[];
}): { blockProps: json | undefined; blockUid: string } => {
  if (keys.length === 0) {
    internalError({
      error: "getBlockPropBasedSettings called with no keys",
      type: "DG Accessor",
    });
    return { blockProps: undefined, blockUid: "" };
  }

  const blockUid = getBlockUidByTextOnPage({
    text: keys[0],
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  if (!blockUid) {
    return { blockProps: undefined, blockUid: "" };
  }

  const blockProps = getBlockPropsByUid(blockUid, keys.slice(1));

  return { blockProps, blockUid };
};

const setBlockPropBasedSettings = ({
  keys,
  value,
}: {
  keys: string[];
  value: json;
}): void => {
  if (keys.length === 0) {
    internalError({
      error: "setBlockPropBasedSettings called with no keys",
      type: "DG Accessor",
    });
    return;
  }

  const blockUid = getBlockUidByTextOnPage({
    text: keys[0],
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  if (!blockUid) {
    internalError({
      error: `Block not found for key "${keys[0]}" on settings page`,
      type: "DG Accessor",
    });
    return;
  }

  setBlockPropAtPath(blockUid, keys.slice(1), value);
};

export const getFeatureFlags = (): FeatureFlags => {
  const { blockProps } = getBlockPropBasedSettings({
    keys: [TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags],
  });

  return FeatureFlagsSchema.parse(blockProps || {});
};

export const getFeatureFlag = (key: keyof FeatureFlags): boolean => {
  const flags = getFeatureFlags();
  return flags[key];
};

export const setFeatureFlag = (
  key: keyof FeatureFlags,
  value: boolean,
): void => {
  const validatedValue = z.boolean().parse(value);

  setBlockPropBasedSettings({
    keys: [TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags, key],
    value: validatedValue,
  });
};

export const getGlobalSettings = (): GlobalSettings => {
  const { blockProps } = getBlockPropBasedSettings({
    keys: [TOP_LEVEL_BLOCK_PROP_KEYS.global],
  });

  return GlobalSettingsSchema.parse(blockProps || {});
};

export const getGlobalSetting = <T = unknown>(
  keys: string[],
): T | undefined => {
  const settings = getGlobalSettings();

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings) as T | undefined;
};

let relationsCache: DiscourseRelationSettings[] | null = null;

export const invalidateRelationsCache = (): void => {
  relationsCache = null;
};

export const setGlobalSetting = (keys: string[], value: json): void => {
  if (keys.length === 0) {
    internalError({
      error: "setGlobalSetting called with empty keys array",
      type: "DG Accessor",
    });
    return;
  }

  if (
    !validateSettingValue({
      schema: GlobalSettingsSchema,
      keys,
      value,
      context: "Global",
    })
  ) {
    return;
  }

  setBlockPropBasedSettings({
    keys: [TOP_LEVEL_BLOCK_PROP_KEYS.global, ...keys],
    value,
  });

  if (keys[0] === "Relations") {
    invalidateRelationsCache();
  }
};

export const getAllRelations = (): DiscourseRelationSettings[] => {
  if (relationsCache) return relationsCache;

  const settings = getGlobalSettings();

  relationsCache = Object.entries(settings.Relations).map(([id, relation]) => ({
    ...relation,
    id,
  }));

  return relationsCache;
};

export const getPersonalSettings = (): PersonalSettings => {
  const personalKey = getPersonalSettingsKey();

  const { blockProps } = getBlockPropBasedSettings({
    keys: [personalKey],
  });

  return PersonalSettingsSchema.parse(blockProps || {});
};

export const getPersonalSetting = <T = unknown>(
  keys: string[],
): T | undefined => {
  const settings = getPersonalSettings();

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings) as T | undefined;
};

export const setPersonalSetting = (keys: string[], value: json): void => {
  if (keys.length === 0) {
    internalError({
      error: "setPersonalSetting called with empty keys array",
      type: "DG Accessor",
    });
    return;
  }

  const personalKey = getPersonalSettingsKey();

  if (
    !validateSettingValue({
      schema: PersonalSettingsSchema,
      keys,
      value,
      context: "Personal",
    })
  ) {
    return;
  }

  setBlockPropBasedSettings({
    keys: [personalKey, ...keys],
    value,
  });
};

export const getDiscourseNodeSettings = (
  nodeType: string,
): DiscourseNodeSettings | undefined => {
  let pageUid = nodeType;
  let blockProps = getBlockPropsByUid(pageUid, []);

  if (!blockProps || Object.keys(blockProps).length === 0) {
    const lookedUpUid = getPageUidByPageTitle(
      `${DISCOURSE_NODE_PAGE_PREFIX}${nodeType}`,
    );
    if (lookedUpUid) {
      pageUid = lookedUpUid;
      blockProps = getBlockPropsByUid(pageUid, []);
    }
  }

  if (!blockProps) return undefined;

  const result = DiscourseNodeSchema.safeParse(blockProps);
  if (!result.success) {
    internalError({
      error: `Failed to parse discourse node settings for ${nodeType}`,
      type: "DG Accessor",
      context: { zodError: result.error.message },
    });
    return undefined;
  }

  return result.data;
};

export const getDiscourseNodeSetting = <T = unknown>(
  nodeType: string,
  keys: string[],
): T | undefined => {
  const settings = getDiscourseNodeSettings(nodeType);

  if (!settings) return undefined;

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings) as T | undefined;
};

let discourseNodesCache: DiscourseNodeSettings[] | null = null;

export const invalidateDiscourseNodesCache = (): void => {
  discourseNodesCache = null;
};

export const setDiscourseNodeSetting = (
  nodeType: string,
  keys: string[],
  value: json,
): void => {
  if (keys.length === 0) {
    internalError({
      error: "setDiscourseNodeSetting called with empty keys array",
      type: "DG Accessor",
    });
    return;
  }

  if (
    !validateSettingValue({
      schema: DiscourseNodeSchema,
      keys,
      value,
      context: "Discourse Node",
    })
  ) {
    return;
  }

  let pageUid = nodeType;
  const blockProps = getBlockPropsByUid(pageUid, []);

  if (!blockProps || Object.keys(blockProps).length === 0) {
    const lookedUpUid = getPageUidByPageTitle(
      `${DISCOURSE_NODE_PAGE_PREFIX}${nodeType}`,
    );
    if (lookedUpUid) {
      pageUid = lookedUpUid;
    }
  }

  if (!pageUid) {
    internalError({
      error: `setDiscourseNodeSetting - could not find page for: ${nodeType}`,
      type: "DG Accessor",
    });
    return;
  }

  setBlockPropAtPath(pageUid, keys, value);
  invalidateDiscourseNodesCache();
};

export const getAllDiscourseNodes = (): DiscourseNodeSettings[] => {
  if (discourseNodesCache) return discourseNodesCache;

  const results = window.roamAlphaAPI.data.fast.q(`
    [:find ?uid ?title (pull ?page [:block/props])
     :where
     [?page :node/title ?title]
     [?page :block/uid ?uid]
     [(clojure.string/starts-with? ?title "${DISCOURSE_NODE_PAGE_PREFIX}")]]
  `) as [string, string, Record<string, json> | null][];

  const nodes: DiscourseNodeSettings[] = [];

  for (const [pageUid, title, rawProps] of results) {
    if (typeof pageUid !== "string" || typeof title !== "string") continue;
    const rawBlockProps = rawProps?.[":block/props"];
    const blockProps = rawBlockProps
      ? normalizeProps(rawBlockProps)
      : undefined;
    if (
      !blockProps ||
      !isRecord(blockProps) ||
      Object.keys(blockProps).length === 0
    )
      continue;

    const result = DiscourseNodeSchema.safeParse(blockProps);
    if (result.success) {
      nodes.push({
        ...result.data,
        type: pageUid,
        text: title.replace(DISCOURSE_NODE_PAGE_PREFIX, ""),
      });
    } else {
      internalError({
        error: result.error,
        type: "DG Discourse Node Parse",
        context: { pageUid, title },
        sendEmail: false,
      });
    }
  }

  discourseNodesCache = nodes;
  return nodes;
};
