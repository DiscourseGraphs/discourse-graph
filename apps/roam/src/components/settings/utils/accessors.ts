import getBlockProps, { type json } from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import { z } from "zod";
import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  TOP_LEVEL_BLOCK_PROP_KEYS,
  DISCOURSE_NODE_PAGE_PREFIX,
} from "../data/blockPropsSettingsConfig";
import {
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  type FeatureFlags,
  type GlobalSettings,
  type PersonalSettings,
  type DiscourseNodeSettings,
} from "./zodSchema";
import {
  getPersonalSettingsKey,
  getDiscourseNodePageUid,
} from "./init";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getBlockPropsByUid = (
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
  if (!blockUid) {
    console.warn("[DG:accessor] setBlockPropsByUid called with empty blockUid");
    return;
  }

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
    console.warn("[DG:accessor] getBlockPropBasedSettings called with no keys");
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

export const setBlockPropBasedSettings = ({
  keys,
  value,
}: {
  keys: string[];
  value: json;
}): void => {
  if (keys.length === 0) {
    console.warn("[DG:accessor] setBlockPropBasedSettings called with no keys");
    return;
  }

  const blockUid = getBlockUidByTextOnPage({
    text: keys[0],
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  if (!blockUid) {
    console.warn(
      `[DG:accessor] Block not found for key "${keys[0]}" on settings page`,
    );
    return;
  }

  setBlockPropsByUid(blockUid, keys.slice(1), value);
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

export const getGlobalSetting = <T = unknown>(keys: string[]): T | undefined => {
  const settings = getGlobalSettings();

  return keys.reduce<unknown>((current, key) => {
    if (!isRecord(current) || !(key in current)) return undefined;
    return current[key];
  }, settings) as T | undefined;
};

export const setGlobalSetting = (keys: string[], value: json): void => {
  setBlockPropBasedSettings({
    keys: [TOP_LEVEL_BLOCK_PROP_KEYS.global, ...keys],
    value,
  });
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
  const personalKey = getPersonalSettingsKey();

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
    const lookedUpUid = getDiscourseNodePageUid(nodeType);
    if (lookedUpUid) {
      pageUid = lookedUpUid;
      blockProps = getBlockPropsByUid(pageUid, []);
    }
  }

  if (!blockProps) return undefined;

  const result = DiscourseNodeSchema.safeParse(blockProps);
  if (!result.success) {
    console.warn(
      `[DG:accessor] Failed to parse discourse node settings for ${nodeType}:`,
      result.error,
    );
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

export const setDiscourseNodeSetting = (
  nodeType: string,
  keys: string[],
  value: json,
): void => {
  let pageUid = nodeType;
  const blockProps = getBlockPropsByUid(pageUid, []);

  if (!blockProps || Object.keys(blockProps).length === 0) {
    const lookedUpUid = getDiscourseNodePageUid(nodeType);
    if (lookedUpUid) {
      pageUid = lookedUpUid;
    }
  }

  if (!pageUid) {
    console.warn(
      `[DG:accessor] setDiscourseNodeSetting - could not find page for: ${nodeType}`,
    );
    return;
  }

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

// =============================================================================
// STUB: Left Sidebar Personal Settings - Setter Demo
// =============================================================================

/* eslint-disable @typescript-eslint/naming-convention */
type SectionSettings = {
  Folded: boolean;
  "Truncate-result?": number;
};

type SectionChild = {
  Page: string;
  Alias: string;
};

type SidebarSection = {
  Settings: SectionSettings;
  Children: SectionChild[];
};

type LeftSidebarSections = {
  [sectionName: string]: SidebarSection;
};

/**
 * STUB: Demonstrates setting up a nested left sidebar structure in personal settings.
 * Creates sections (Meetings, Personal, Projects) directly under Left Sidebar,
 * each having their own Settings and Children arrays.
 */
export const stubSetLeftSidebarPersonalSections = (): void => {
  const leftSidebarData: LeftSidebarSections = {
    Meetings: {
      Settings: {
        Folded: false,
        "Truncate-result?": 75,
      },
      Children: [
        { Page: "Eb7OxsR6i", Alias: "" },
        { Page: "1hafIrWqM", Alias: "" },
        { Page: "zNMYS5S35", Alias: "" },
        { Page: "3moLsJc2U", Alias: "" },
      ],
    },
    Personal: {
      Settings: {
        Folded: false,
        "Truncate-result?": 75,
      },
      Children: [{ Page: "ZrHOdhXB2", Alias: "" }],
    },
    Projects: {
      Settings: {
        Folded: false,
        "Truncate-result?": 75,
      },
      Children: [
        { Page: "_U0xx3b_D", Alias: "" },
        { Page: "ACgmBdyMz", Alias: "" },
      ],
    },
  };

  // Set the entire nested structure directly under Left Sidebar
  setPersonalSetting(["Left Sidebar"], leftSidebarData as unknown as json);

  console.log(
    "[DG:stub] Left Sidebar structure set:",
    leftSidebarData,
  );
};

// =============================================================================
// STUB: Left Sidebar Personal Settings - Getter Demo
// =============================================================================

/**
 * STUB: Demonstrates the full capabilities of the getter functions
 * for accessing nested left sidebar personal settings at various depths.
 */
export const stubGetLeftSidebarPersonalSections = (): void => {
  console.group("🔍 [DG:stub] Left Sidebar Getter Capabilities Demo");

  // 1. Get entire Left Sidebar settings (all sections)
  const entireLeftSidebar = getPersonalSetting<LeftSidebarSections>([
    "Left Sidebar",
  ]);
  console.log("1. Entire Left Sidebar:", entireLeftSidebar);

  // 2. Get a specific section (Meetings)
  const meetingsSection = getPersonalSetting<SidebarSection>([
    "Left Sidebar",
    "Meetings",
  ]);
  console.log("2. Meetings Section:", meetingsSection);

  // 3. Get Settings for a specific section
  const meetingsSettings = getPersonalSetting<SectionSettings>([
    "Left Sidebar",
    "Meetings",
    "Settings",
  ]);
  console.log("3. Meetings Settings:", meetingsSettings);

  // 4. Get a specific setting value (Truncate-result?)
  const truncateValue = getPersonalSetting<number>([
    "Left Sidebar",
    "Meetings",
    "Settings",
    "Truncate-result?",
  ]);
  console.log("4. Meetings Truncate-result? value:", truncateValue);

  // 5. Get Folded state for Meetings section
  const meetingsFolded = getPersonalSetting<boolean>([
    "Left Sidebar",
    "Meetings",
    "Settings",
    "Folded",
  ]);
  console.log("5. Meetings Folded state:", meetingsFolded);

  // 6. Get Children array for a section
  const projectsChildren = getPersonalSetting<SectionChild[]>([
    "Left Sidebar",
    "Projects",
    "Children",
  ]);
  console.log("6. Projects Children:", projectsChildren);

  // 7. Get Personal section completely
  const personalSection = getPersonalSetting<SidebarSection>([
    "Left Sidebar",
    "Personal",
  ]);
  console.log("7. Personal section:", personalSection);

  // 8. Demonstrate accessing non-existent path (returns undefined)
  const nonExistent = getPersonalSetting<unknown>([
    "Left Sidebar",
    "NonExistentSection",
    "Settings",
  ]);
  console.log("8. Non-existent path (should be undefined):", nonExistent);

  console.groupEnd();
};
