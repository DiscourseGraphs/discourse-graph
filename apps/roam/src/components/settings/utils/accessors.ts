import getBlockProps, {
  normalizeProps,
  type json,
} from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getSubTree } from "roamjs-components/util";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import internalError from "~/utils/internalError";
import { getSetting } from "~/utils/extensionSettings";

import discourseConfigRef from "~/utils/discourseConfigRef";
import { roamNodeToCondition } from "~/utils/parseQuery";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { Condition } from "~/utils/types";
import { z } from "zod";
import {
  getExportSettingsAndUids,
  getUidAndBooleanSetting,
  getUidAndStringSetting,
} from "~/utils/getExportSettings";
import { getSuggestiveModeConfigAndUids } from "~/utils/getSuggestiveModeConfigSettings";
import { getLeftSidebarSettings } from "~/utils/getLeftSidebarSettings";

import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  DISCOURSE_NODE_PAGE_PREFIX,
  STATIC_TOP_LEVEL_ENTRIES,
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  getPersonalSettingsKey,
  type FeatureFlags,
  type GlobalSettings,
  type PersonalSettings,
  type DiscourseNodeSettings,
  type Condition as SchemaCondition,
} from "./zodSchema";
import { PERSONAL_KEYS, QUERY_KEYS, GLOBAL_KEYS } from "./settingKeys";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  const isEmpty = (v: unknown) =>
    v === undefined || v === null || v === "" || v === false;
  if (isEmpty(a) && isEmpty(b)) return true;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
};

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

const readPathValue = (root: unknown, keys: string[]): unknown =>
  keys.reduce<unknown>((current, key) => {
    if (Array.isArray(current)) {
      const index = Number(key);
      return Number.isInteger(index) && index >= 0 && index < current.length
        ? current[index]
        : undefined;
    }
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, root);

const pathKey = (keys: string[]): string => keys.join("::");

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

const DEFAULT_PERSONAL_SETTINGS = PersonalSettingsSchema.parse({});
const DEFAULT_GLOBAL_SETTINGS = GlobalSettingsSchema.parse({});
const DEFAULT_LEGACY_QUERY = {
  conditions: [],
  selections: [],
  custom: "",
  returnNode: "node",
};

const PERSONAL_SCHEMA_PATH_TO_LEGACY_KEY = new Map<string, string>([
  [
    pathKey([PERSONAL_KEYS.discourseContextOverlay]),
    "discourse-context-overlay",
  ],
  [pathKey([PERSONAL_KEYS.textSelectionPopup]), "text-selection-popup"],
  [pathKey([PERSONAL_KEYS.disableSidebarOpen]), "disable-sidebar-open"],
  [pathKey([PERSONAL_KEYS.pagePreview]), "page-preview"],
  [pathKey([PERSONAL_KEYS.hideFeedbackButton]), "hide-feedback-button"],
  [pathKey([PERSONAL_KEYS.autoCanvasRelations]), "auto-canvas-relations"],
  [
    pathKey([PERSONAL_KEYS.overlayInCanvas]),
    "discourse-context-overlay-in-canvas",
  ],
  [pathKey([PERSONAL_KEYS.streamlineStyling]), "streamline-styling"],
  [pathKey([PERSONAL_KEYS.disableProductDiagnostics]), "disallow-diagnostics"],
  [pathKey([PERSONAL_KEYS.discourseToolShortcut]), "discourse-tool-shortcut"],
  [
    pathKey([PERSONAL_KEYS.personalNodeMenuTrigger]),
    "personal-node-menu-trigger",
  ],
  [pathKey([PERSONAL_KEYS.nodeSearchMenuTrigger]), "node-search-trigger"],
  [
    pathKey([PERSONAL_KEYS.query, QUERY_KEYS.hideQueryMetadata]),
    "hide-metadata",
  ],
  [
    pathKey([PERSONAL_KEYS.query, QUERY_KEYS.defaultPageSize]),
    "default-page-size",
  ],
  [pathKey([PERSONAL_KEYS.query, QUERY_KEYS.queryPages]), "query-pages"],
  [
    pathKey([PERSONAL_KEYS.query, QUERY_KEYS.defaultFilters]),
    "default-filters",
  ],
  [pathKey([PERSONAL_KEYS.reifiedRelationTriples]), "use-reified-relations"],
]);

const getLegacyPersonalLeftSidebarSetting = (): unknown[] => {
  const settings = getLeftSidebarSettings(discourseConfigRef.tree);

  /* eslint-disable @typescript-eslint/naming-convention */
  return settings.personal.sections.map((section) => ({
    name: section.text,
    Children: (section.children || []).map((child) => ({
      uid: child.text,
      Alias: child.alias?.value || "",
    })),
    Settings: {
      "Truncate-result?": section.settings?.truncateResult.value ?? 75,
      Folded: section.settings?.folded.value ?? false,
    },
  }));
  /* eslint-enable @typescript-eslint/naming-convention */
};

const getLegacyPersonalSetting = (keys: string[]): unknown => {
  if (keys.length === 0) return undefined;

  const mappedOldKey = PERSONAL_SCHEMA_PATH_TO_LEGACY_KEY.get(pathKey(keys));
  if (mappedOldKey) {
    return getSetting<unknown>(
      mappedOldKey,
      readPathValue(DEFAULT_PERSONAL_SETTINGS, keys),
    );
  }

  if (keys.length === 1 && keys[0] === "Query") {
    const querySettings: Record<string, unknown> = {};
    querySettings["Hide query metadata"] = getLegacyPersonalSetting([
      "Query",
      "Hide query metadata",
    ]);
    querySettings["Default page size"] = getLegacyPersonalSetting([
      "Query",
      "Default page size",
    ]);
    querySettings["Query pages"] = getLegacyPersonalSetting([
      "Query",
      "Query pages",
    ]);
    querySettings["Default filters"] = getLegacyPersonalSetting([
      "Query",
      "Default filters",
    ]);
    return querySettings;
  }

  if (keys[0] === "Left sidebar") {
    const leftSidebarSettings = getLegacyPersonalLeftSidebarSetting();
    if (keys.length === 1) return leftSidebarSettings;
    return readPathValue(leftSidebarSettings, keys.slice(1));
  }

  return undefined;
};

const getLegacyRelationsSetting = (): Record<string, unknown> => {
  const settingsUid = getPageUidByPageTitle(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  if (!settingsUid) return DEFAULT_GLOBAL_SETTINGS.Relations;

  const configTree = getBasicTreeByParentUid(settingsUid);
  const grammarChildren = getSubTree({
    tree: configTree,
    key: "grammar",
  }).children;
  const relationNodes = getSubTree({
    tree: grammarChildren,
    key: "relations",
  }).children;
  if (relationNodes.length === 0) return DEFAULT_GLOBAL_SETTINGS.Relations;

  return Object.fromEntries(
    relationNodes.map((relationNode) => {
      const relationTree = relationNode.children;
      const ifBlocks = getSubTree({ tree: relationTree, key: "If" }).children;
      const ifConditions = ifBlocks.map((ifBlock) => {
        const blockChildren = ifBlock.children;
        const nodePositionsNode = blockChildren.find((c) =>
          /node positions/i.test(c.text),
        );
        const triples = blockChildren
          .filter((c) => !/node positions/i.test(c.text))
          .map(
            (c) =>
              [
                c.text,
                c.children[0]?.text || "",
                c.children[0]?.children[0]?.text || "",
              ] as [string, string, string],
          );
        const nodePositions = Object.fromEntries(
          (nodePositionsNode?.children || []).map((c) => [
            c.text,
            c.children[0]?.text || "",
          ]),
        );
        return { triples, nodePositions };
      });

      return [
        relationNode.uid || relationNode.text,
        {
          label: relationNode.text,
          source: getSettingValueFromTree({
            tree: relationTree,
            key: "Source",
          }),
          destination: getSettingValueFromTree({
            tree: relationTree,
            key: "Destination",
          }),
          complement: getSettingValueFromTree({
            tree: relationTree,
            key: "Complement",
          }),
          ifConditions,
        },
      ];
    }),
  );
};

// Reconstructs global settings from legacy Roam tree to match block-props schema shape
const getLegacyGlobalSetting = (keys: string[]): unknown => {
  if (keys.length === 0) return undefined;

  const tree = discourseConfigRef.tree;
  const firstKey = keys[0];

  if (firstKey === "Trigger") {
    return (
      getUidAndStringSetting({ tree, text: "trigger" }).value ||
      DEFAULT_GLOBAL_SETTINGS.Trigger
    );
  }

  if (firstKey === "Canvas page format") {
    return (
      getUidAndStringSetting({ tree, text: "Canvas Page Format" }).value ||
      DEFAULT_GLOBAL_SETTINGS["Canvas page format"]
    );
  }

  if (firstKey === "Left sidebar") {
    const sidebar = getLeftSidebarSettings(tree);
    const leftSidebarSettings: Record<string, unknown> = {};
    leftSidebarSettings["Children"] = sidebar.global.children.map(
      (c) => c.text,
    );
    const sidebarSettingValues: Record<string, unknown> = {};
    sidebarSettingValues["Collapsable"] =
      sidebar.global.settings?.collapsable.value ??
      DEFAULT_GLOBAL_SETTINGS["Left sidebar"].Settings.Collapsable;
    sidebarSettingValues["Folded"] =
      sidebar.global.settings?.folded.value ??
      DEFAULT_GLOBAL_SETTINGS["Left sidebar"].Settings.Folded;
    leftSidebarSettings["Settings"] = sidebarSettingValues;
    if (keys.length === 1) return leftSidebarSettings;
    return readPathValue(leftSidebarSettings, keys.slice(1));
  }

  if (firstKey === "Export") {
    const exp = getExportSettingsAndUids();
    const exportSettings: Record<string, unknown> = {};
    exportSettings["Remove special characters"] =
      exp.removeSpecialCharacters.value ??
      DEFAULT_GLOBAL_SETTINGS.Export["Remove special characters"];
    exportSettings["Resolve block references"] =
      exp.optsRefs.value ??
      DEFAULT_GLOBAL_SETTINGS.Export["Resolve block references"];
    exportSettings["Resolve block embeds"] =
      exp.optsEmbeds.value ??
      DEFAULT_GLOBAL_SETTINGS.Export["Resolve block embeds"];
    exportSettings["Append referenced node"] =
      exp.appendRefNodeContext.value ??
      DEFAULT_GLOBAL_SETTINGS.Export["Append referenced node"];
    exportSettings["Link type"] =
      exp.linkType.value || DEFAULT_GLOBAL_SETTINGS.Export["Link type"];
    exportSettings["Max filename length"] =
      exp.maxFilenameLength.value ??
      DEFAULT_GLOBAL_SETTINGS.Export["Max filename length"];
    exportSettings["Frontmatter"] =
      exp.frontmatter.values ?? DEFAULT_GLOBAL_SETTINGS.Export.Frontmatter;
    if (keys.length === 1) return exportSettings;
    return readPathValue(exportSettings, keys.slice(1));
  }

  if (firstKey === "Suggestive mode") {
    const sm = getSuggestiveModeConfigAndUids(tree);
    const suggestiveModeSettings: Record<string, unknown> = {};
    suggestiveModeSettings["Include current page relations"] =
      sm.includePageRelations.value ??
      DEFAULT_GLOBAL_SETTINGS["Suggestive mode"][
        "Include current page relations"
      ];
    suggestiveModeSettings["Include parent and child blocks"] =
      sm.includeParentAndChildren.value ??
      DEFAULT_GLOBAL_SETTINGS["Suggestive mode"][
        "Include parent and child blocks"
      ];
    suggestiveModeSettings["Page groups"] = sm.pageGroups.groups.map(
      (group) => ({
        name: group.name,
        pages: group.pages.map((page) => page.name),
      }),
    );
    if (keys.length === 1) return suggestiveModeSettings;
    return readPathValue(suggestiveModeSettings, keys.slice(1));
  }

  if (firstKey === "Relations") {
    const relationsSettings = getLegacyRelationsSetting();
    if (keys.length === 1) return relationsSettings;
    return readPathValue(relationsSettings, keys.slice(1));
  }

  return undefined;
};

const getLegacyQuerySettingByParentUid = (parentUid: string) => {
  const scratchNode = getSubTree({
    tree: getBasicTreeByParentUid(parentUid),
    key: "scratch",
  });
  const conditionsNode = getSubTree({
    tree: scratchNode.children,
    key: "conditions",
  });
  const selectionsNode = getSubTree({
    tree: scratchNode.children,
    key: "selections",
  });
  const customNode = getSubTree({ tree: scratchNode.children, key: "custom" });

  return {
    conditions: conditionsNode.children.map(roamNodeToCondition),
    selections: selectionsNode.children.map((s) => ({
      text: s.text,
      label: s.children[0]?.text || "",
    })),
    custom: customNode.children[0]?.text || "",
    returnNode: "node",
  };
};

// Reconstructs per-node settings from Roam tree structure to match block-props schema shape
const getLegacyDiscourseNodeSetting = (
  nodeType: string,
  keys: string[],
): unknown => {
  let nodeUid = nodeType;
  let tree = getBasicTreeByParentUid(nodeUid);

  if (tree.length === 0) {
    const lookedUpUid = getPageUidByPageTitle(
      `${DISCOURSE_NODE_PAGE_PREFIX}${nodeType}`,
    );
    if (lookedUpUid) {
      nodeUid = lookedUpUid;
      tree = getBasicTreeByParentUid(nodeUid);
    }
  }

  if (tree.length === 0) return undefined;

  const rawCanvas = Object.fromEntries(
    getSubTree({ tree, key: "canvas" }).children.map((c) => [
      c.text,
      c.children[0]?.text || "",
    ]),
  );
  /* eslint-disable @typescript-eslint/naming-convention */
  const canvasSettings = {
    color: rawCanvas["color"] || "",
    alias: rawCanvas["alias"] || "",
    "key-image": rawCanvas["key-image"] === "true",
    "key-image-option": rawCanvas["key-image-option"] || "first-image",
    "query-builder-alias": rawCanvas["query-builder-alias"] || "",
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  const attributes = Object.fromEntries(
    getSubTree({ tree, key: "Attributes" }).children.map((c) => [
      c.text,
      c.children[0]?.text || "",
    ]),
  );
  const overlayUid = getSubTree({ tree, key: "Overlay" }).uid;
  const suggestiveRulesTree = getSubTree({
    tree,
    key: "Suggestive Rules",
  }).children;
  const indexUid = getSubTree({ tree, key: "Index" }).uid;
  const specificationUid = getSubTree({ tree, key: "Specification" }).uid;
  const specificationQuery = specificationUid
    ? getLegacyQuerySettingByParentUid(specificationUid)
    : DEFAULT_LEGACY_QUERY;

  const legacySettings = {
    type: nodeUid,
    format: getSettingValueFromTree({ tree, key: "format" }),
    shortcut: getSettingValueFromTree({ tree, key: "shortcut" }),
    tag: getSettingValueFromTree({ tree, key: "tag" }),
    graphOverview: tree.some((c) => c.text === "Graph Overview"),
    description: getSettingValueFromTree({ tree, key: "description" }),
    overlay: overlayUid
      ? getBasicTreeByParentUid(overlayUid)[0]?.text || ""
      : "",
    attributes,
    template: getSubTree({ tree, key: "template" }).children,
    canvasSettings,
    suggestiveRules: {
      embeddingRef:
        getSubTree({ tree: suggestiveRulesTree, key: "Embedding Block Ref" })
          .children[0]?.text || "",
      isFirstChild: !!getSubTree({
        tree: suggestiveRulesTree,
        key: "First Child",
      }).uid,
    },
    index: indexUid
      ? getLegacyQuerySettingByParentUid(indexUid)
      : DEFAULT_LEGACY_QUERY,
    specification: {
      enabled: specificationUid
        ? getBasicTreeByParentUid(specificationUid).some(
            (c) => c.text === "enabled",
          )
        : false,
      query: specificationQuery,
    },
  };

  return readPathValue(legacySettings, keys);
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
  return bulkReadSettings().featureFlags;
};

/* eslint-disable @typescript-eslint/naming-convention */
const FEATURE_FLAG_LEGACY_MAP: Partial<
  Record<keyof FeatureFlags, () => boolean>
> = {
  "Enable left sidebar": () =>
    getUidAndBooleanSetting({
      tree: discourseConfigRef.tree,
      text: "(BETA) Left Sidebar",
    }).value,
};
/* eslint-enable @typescript-eslint/naming-convention */

export const getFeatureFlag = (key: keyof FeatureFlags): boolean => {
  return bulkReadSettings().featureFlags[key];
};

export const isNewSettingsStoreEnabled = (): boolean => {
  return getFeatureFlag("Use new settings store");
};

export const readAllLegacyFeatureFlags = (): Partial<FeatureFlags> => {
  const flags: Partial<FeatureFlags> = {};
  for (const [key, reader] of Object.entries(FEATURE_FLAG_LEGACY_MAP)) {
    flags[key as keyof FeatureFlags] = reader();
  }
  flags["Use new settings store"] = false;
  return flags;
};

export const readAllLegacyGlobalSettings = (): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.values(GLOBAL_KEYS)) {
    result[key] = getLegacyGlobalSetting([key]);
  }
  return result;
};

export const readAllLegacyPersonalSettings = (): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.values(PERSONAL_KEYS)) {
    result[key] = getLegacyPersonalSetting([key]);
  }
  return result;
};

export const readAllLegacyDiscourseNodeSettings = (
  nodeType: string,
  nodeTitle: string,
): Record<string, unknown> | undefined => {
  const raw = getLegacyDiscourseNodeSetting(nodeType, []);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return { ...(raw as Record<string, unknown>), text: nodeTitle };
};

export const isSyncEnabled = (): boolean =>
  getFeatureFlag("Duplicate node alert enabled") ||
  getFeatureFlag("Suggestive mode overlay enabled");

export const setFeatureFlag = (
  key: keyof FeatureFlags,
  value: boolean,
): void => {
  const validatedValue = z.boolean().parse(value);

  setBlockPropBasedSettings({
    keys: [STATIC_TOP_LEVEL_ENTRIES.featureFlags.key, key],
    value: validatedValue,
  });
};

export const getGlobalSettings = (): GlobalSettings => {
  return bulkReadSettings().globalSettings;
};

export const getGlobalSetting = <T = unknown>(
  keys: string[],
): T | undefined => {
  if (keys.length === 0) return undefined;
  return readPathValue(bulkReadSettings().globalSettings, keys) as
    | T
    | undefined;
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
    keys: [STATIC_TOP_LEVEL_ENTRIES.global.key, ...keys],
    value,
  });
};

export const getAllRelations = (
  settings?: SettingsSnapshot,
): DiscourseRelation[] => {
  const globalSettings = settings
    ? settings.globalSettings
    : getGlobalSettings();

  return Object.entries(globalSettings.Relations).flatMap(([id, relation]) =>
    relation.ifConditions.map((ifCondition) => ({
      id,
      label: relation.label,
      source: relation.source,
      destination: relation.destination,
      complement: relation.complement,
      triples: ifCondition.triples,
    })),
  );
};

export const getPersonalSettings = (): PersonalSettings => {
  return bulkReadSettings().personalSettings;
};

export const getPersonalSetting = <T = unknown>(
  keys: string[],
): T | undefined => {
  if (keys.length === 0) return undefined;
  return readPathValue(bulkReadSettings().personalSettings, keys) as
    | T
    | undefined;
};

export type SettingsSnapshot = {
  featureFlags: FeatureFlags;
  globalSettings: GlobalSettings;
  personalSettings: PersonalSettings;
};

export const bulkReadSettings = (): SettingsSnapshot => {
  const pageResult = window.roamAlphaAPI.pull(
    "[{:block/children [:block/string :block/props]}]",
    [":node/title", DG_BLOCK_PROP_SETTINGS_PAGE_TITLE],
  ) as Record<string, json> | null;

  const children = (pageResult?.[":block/children"] ?? []) as Record<
    string,
    json
  >[];
  const personalKey = getPersonalSettingsKey();
  let featureFlagsProps: json = {};
  let globalProps: json = {};
  let personalProps: json = {};

  for (const child of children) {
    const text = child[":block/string"];
    if (typeof text !== "string") continue;
    const rawBlockProps = child[":block/props"];
    const blockProps =
      rawBlockProps && typeof rawBlockProps === "object"
        ? normalizeProps(rawBlockProps)
        : {};
    if (text === STATIC_TOP_LEVEL_ENTRIES.featureFlags.key) {
      featureFlagsProps = blockProps;
    } else if (text === STATIC_TOP_LEVEL_ENTRIES.global.key) {
      globalProps = blockProps;
    } else if (text === personalKey) {
      personalProps = blockProps;
    }
  }

  const featureFlags = FeatureFlagsSchema.parse(featureFlagsProps || {});

  if (!featureFlags["Use new settings store"]) {
    return {
      featureFlags,
      globalSettings: readAllLegacyGlobalSettings() as GlobalSettings,
      personalSettings: readAllLegacyPersonalSettings() as PersonalSettings,
    };
  }

  return {
    featureFlags,
    globalSettings: GlobalSettingsSchema.parse(globalProps || {}),
    personalSettings: PersonalSettingsSchema.parse(personalProps || {}),
  };
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

const getRawDiscourseNodeBlockProps = (
  nodeType: string,
): Record<string, json> | undefined => {
  let pageUid = nodeType;
  let blockProps = getBlockPropsByUid(pageUid, []);

  if (!isRecord(blockProps) || Object.keys(blockProps).length === 0) {
    const lookedUpUid = getPageUidByPageTitle(
      `${DISCOURSE_NODE_PAGE_PREFIX}${nodeType}`,
    );
    if (lookedUpUid) {
      pageUid = lookedUpUid;
      blockProps = getBlockPropsByUid(pageUid, []);
    }
  }

  return isRecord(blockProps) && Object.keys(blockProps).length > 0
    ? (blockProps as Record<string, json>)
    : undefined;
};

export const getDiscourseNodeSettings = (
  nodeType: string,
): DiscourseNodeSettings | undefined => {
  const blockProps = getRawDiscourseNodeBlockProps(nodeType);
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
  if (!bulkReadSettings().featureFlags["Use new settings store"]) {
    return getLegacyDiscourseNodeSetting(nodeType, keys) as T | undefined;
  }

  const settings = getDiscourseNodeSettings(nodeType);
  return (settings ? readPathValue(settings, keys) : undefined) as
    | T
    | undefined;
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

  if (!blockProps || Object.keys(blockProps).length === 0) {
    internalError({
      error: `setDiscourseNodeSetting - could not find page for: ${nodeType}`,
      type: "DG Accessor",
    });
    return;
  }

  setBlockPropAtPath(pageUid, keys, value);
};

const addConditionUids = (conditions: SchemaCondition[]): Condition[] =>
  conditions.map((c) => {
    const uid = window.roamAlphaAPI.util.generateUID();
    if (c.type === "or" || c.type === "not or") {
      return {
        uid,
        type: c.type,
        conditions: c.conditions.map(addConditionUids),
      };
    }
    return {
      uid,
      type: c.type,
      source: c.source,
      relation: c.relation,
      target: c.target,
      not: c.not,
    };
  }) as Condition[];

const toDiscourseNode = (settings: DiscourseNodeSettings): DiscourseNode => ({
  text: settings.text,
  type: settings.type,
  shortcut: settings.shortcut,
  tag: settings.tag || undefined,
  format: settings.format,
  description: settings.description || undefined,
  graphOverview: settings.graphOverview || undefined,
  backedBy: "user",
  specification: addConditionUids(
    settings.specification.query.conditions as SchemaCondition[],
  ),
  canvasSettings: Object.fromEntries(
    Object.entries(settings.canvasSettings).map(([k, v]) => [
      k,
      typeof v === "boolean" ? (v ? "true" : "") : String(v),
    ]),
  ),
  template: settings.template.length > 0 ? settings.template : undefined,
  embeddingRef: settings.suggestiveRules.embeddingRef || undefined,
  isFirstChild: settings.suggestiveRules.isFirstChild
    ? { uid: "", value: true }
    : undefined,
});

/**
 * Migrate known legacy block prop shapes to the current schema.
 *
 * - specification: Condition[] → {enabled, query: {conditions, ...}}
 * - specification: {enabled, query: Condition[]} → {enabled, query: {conditions, ...}}
 * - suggestiveRules.isFirstChild: {uid, value} → boolean
 */
const migrateNodeBlockProps = (
  props: Record<string, json>,
): Record<string, json> => {
  const migrated = { ...props };

  if (Array.isArray(migrated.specification)) {
    migrated.specification = {
      enabled: migrated.specification.length > 0,
      query: {
        conditions: migrated.specification,
        selections: [],
        custom: "",
        returnNode: "node",
      },
    };
  } else if (
    typeof migrated.specification === "object" &&
    migrated.specification !== null &&
    "query" in migrated.specification &&
    Array.isArray((migrated.specification as Record<string, json>).query)
  ) {
    const spec = migrated.specification as Record<string, json>;
    migrated.specification = {
      enabled:
        typeof spec.enabled === "boolean"
          ? spec.enabled
          : (spec.query as json[]).length > 0,
      query: {
        conditions: spec.query,
        selections: [],
        custom: "",
        returnNode: "node",
      },
    };
  }

  if (
    typeof migrated.suggestiveRules === "object" &&
    migrated.suggestiveRules !== null &&
    !Array.isArray(migrated.suggestiveRules)
  ) {
    const rules = migrated.suggestiveRules as Record<string, json>;
    const ifc = rules.isFirstChild;
    if (typeof ifc === "object" && ifc !== null && !Array.isArray(ifc)) {
      migrated.suggestiveRules = {
        ...rules,
        isFirstChild: (ifc as Record<string, json>).value ?? false,
      };
    }
  }

  return migrated;
};

export const getAllDiscourseNodes = (): DiscourseNode[] => {
  const results = window.roamAlphaAPI.data.fast.q(`
    [:find ?uid ?title (pull ?page [:block/props])
     :where
     [?page :node/title ?title]
     [?page :block/uid ?uid]
     [(clojure.string/starts-with? ?title "${DISCOURSE_NODE_PAGE_PREFIX}")]]
  `) as [string, string, Record<string, json> | null][];

  const nodes: DiscourseNode[] = [];

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

    const nodeText = title.replace(DISCOURSE_NODE_PAGE_PREFIX, "");
    const result = DiscourseNodeSchema.safeParse(blockProps);
    if (result.success) {
      nodes.push(
        toDiscourseNode({
          ...result.data,
          type: pageUid,
          text: nodeText,
        }),
      );
    } else {
      // Try migrating legacy field shapes before dropping the node.
      const migrated = migrateNodeBlockProps(
        blockProps as Record<string, json>,
      );
      const retryResult = DiscourseNodeSchema.safeParse(migrated);
      if (retryResult.success) {
        setBlockProps(pageUid, retryResult.data, false);
        nodes.push(
          toDiscourseNode({
            ...retryResult.data,
            type: pageUid,
            text: nodeText,
          }),
        );
      } else {
        internalError({
          error: retryResult.error,
          type: "DG Discourse Node Parse",
          context: { pageUid, title },
          sendEmail: false,
        });
      }
    }
  }

  return nodes;
};
