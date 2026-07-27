import { RoamBasicNode } from "roamjs-components/types";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import extractRef from "roamjs-components/util/extractRef";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import {
  BooleanSetting,
  getUidAndBooleanSetting,
  IntSetting,
  getUidAndIntSetting,
  StringSetting,
  getUidAndStringSetting,
} from "./getExportSettings";
import { getSubTree } from "roamjs-components/util";
import type {
  LeftSidebarGlobalSettings,
  PersonalSection,
} from "~/components/settings/utils/zodSchema";

type StringSettingWithValueUid = StringSetting & { valueUid?: string };

type LeftSidebarPersonalSectionSettings = {
  uid: string;
  truncateResult: IntSetting;
  folded: BooleanSetting;
  alias?: StringSettingWithValueUid;
  resultLimit?: IntSetting;
};

const BLOCK_REF_FULL_MATCH = new RegExp(`^${BLOCK_REF_REGEX.source}$`);
export const QUERY_BLOCK_MARKER = /\{\{query block(?::[^}]*)?\}\}/;

const getUidAndStringSettingWithValueUid = ({
  tree,
  text,
}: {
  tree: RoamBasicNode[];
  text: string;
}): StringSettingWithValueUid => {
  const node = tree.find((node) => node.text === text);
  const valueChild = node?.children?.[0];
  return {
    uid: node?.uid,
    value: valueChild?.text ?? "",
    valueUid: valueChild?.uid,
  };
};

export const isQueryBlockRef = (text: string): boolean => {
  if (!BLOCK_REF_FULL_MATCH.test(text)) return false;
  const blockText = getTextByBlockUid(extractRef(text));
  if (!blockText) return false;
  if (blockText.includes(":SmartBlock:")) return false;
  return QUERY_BLOCK_MARKER.test(blockText);
};

export type PersonalSectionChild = RoamBasicNode & {
  alias: StringSetting;
};

export type LeftSidebarPersonalSectionConfig = {
  uid: string;
  text: string;
  settings?: LeftSidebarPersonalSectionSettings;
  children?: PersonalSectionChild[];
  childrenUid?: string;
};

export type LeftSidebarGlobalSectionConfig = {
  uid: string;
  children: RoamBasicNode[];
  childrenUid: string;
};

export type LeftSidebarConfig = {
  uid: string;
  favoritesMigrated: BooleanSetting;
  sidebarMigrated: BooleanSetting;
  global: LeftSidebarGlobalSectionConfig;
  globalSectionFolded: BooleanSetting;
  allPersonalSections: AllUsersPersonalSections;
  personal: {
    uid: string;
    sections: LeftSidebarPersonalSectionConfig[];
  };
};

export const getGlobalSectionFoldedMarkerText = (userUid: string): string =>
  `${userUid}/Global-Section-Folded`;

export const getLeftSidebarGlobalSectionConfig = (
  leftSidebarChildren: RoamBasicNode[],
): LeftSidebarGlobalSectionConfig => {
  const globalSectionNode = getSubTree({
    tree: leftSidebarChildren,
    key: "Global-Section",
  });
  const globalChildren = globalSectionNode?.children || [];

  const childrenNode = getSubTree({
    tree: globalChildren,
    key: "Children",
  });

  return {
    uid: globalSectionNode?.uid || "",
    children: childrenNode?.children || [],
    childrenUid: childrenNode?.uid || "",
  };
};

const getPersonalSectionSettings = (
  settingsNode: RoamBasicNode,
): LeftSidebarPersonalSectionSettings => {
  const settingsTree = settingsNode?.children || [];

  const truncateResultSetting = getUidAndIntSetting({
    tree: settingsTree,
    text: "Truncate-result?",
  });

  if (truncateResultSetting.value === 0) {
    truncateResultSetting.value = 75;
  }
  const foldedSetting = getUidAndBooleanSetting({
    tree: settingsTree,
    text: "Folded",
  });

  const aliasSetting = getUidAndStringSettingWithValueUid({
    tree: settingsTree,
    text: "Alias",
  });

  const resultLimitSetting = getUidAndIntSetting({
    tree: settingsTree,
    text: "Result-limit",
    defaultValue: 10,
  });

  return {
    uid: settingsNode.uid,
    truncateResult: truncateResultSetting,
    folded: foldedSetting,
    alias: aliasSetting,
    resultLimit: resultLimitSetting,
  };
};

export type AllUsersPersonalSections = {
  [userUid: string]: {
    uid: string;
    sections: LeftSidebarPersonalSectionConfig[];
  };
};

export const getLeftSidebarPersonalSectionConfig = (
  leftSidebarChildren: RoamBasicNode[],
  userUid?: string,
): { uid: string; sections: LeftSidebarPersonalSectionConfig[] } => {
  const targetUserUid = userUid ?? window.roamAlphaAPI.user.uid();

  const personalLeftSidebarNode = getSubTree({
    tree: leftSidebarChildren,
    key: targetUserUid + "/Personal-Section",
  });

  if (personalLeftSidebarNode.uid === "") {
    return {
      uid: "",
      sections: [],
    };
  }

  const sections = (personalLeftSidebarNode?.children || []).map(
    (sectionNode): LeftSidebarPersonalSectionConfig => {
      const settingsNode = sectionNode.children?.find(
        (child) => child.text === "Settings",
      );
      const childrenNode = sectionNode.children?.find(
        (child) => child.text === "Children",
      );
      return {
        uid: sectionNode.uid,
        text: sectionNode.text,
        settings: settingsNode
          ? getPersonalSectionSettings(settingsNode)
          : undefined,
        children: (childrenNode?.children || []).map((child) => ({
          ...child,
          alias: getUidAndStringSetting({
            tree: child.children || [],
            text: "Alias",
          }),
        })),
        childrenUid: childrenNode?.uid || "",
      };
    },
  );

  return {
    uid: personalLeftSidebarNode.uid,
    sections,
  };
};
export const getAllLeftSidebarPersonalSectionConfigs = (
  leftSidebarChildren: RoamBasicNode[],
): AllUsersPersonalSections => {
  const result: AllUsersPersonalSections = {};

  leftSidebarChildren
    .filter((node) => node.text.endsWith("/Personal-Section"))
    .forEach((node) => {
      const userUid = node.text.replace("/Personal-Section", "");
      result[userUid] = getLeftSidebarPersonalSectionConfig(
        leftSidebarChildren,
        userUid,
      );
    });

  return result;
};

export const mergeGlobalSectionWithAccessor = (
  config: LeftSidebarGlobalSectionConfig,
  globalValues: LeftSidebarGlobalSettings | undefined,
): LeftSidebarGlobalSectionConfig => {
  const legacyChildByPageUid = new Map(config.children.map((c) => [c.text, c]));
  const children: RoamBasicNode[] = (globalValues?.Children ?? []).map(
    (targetPageUid) => {
      const legacyChild = legacyChildByPageUid.get(targetPageUid);
      return {
        uid: legacyChild?.uid ?? "",
        text: targetPageUid,
        children: legacyChild?.children ?? [],
      };
    },
  );

  return {
    uid: config.uid,
    childrenUid: config.childrenUid,
    children,
  };
};

export const mergePersonalSectionsWithAccessor = (
  sections: LeftSidebarPersonalSectionConfig[],
  personalValues: PersonalSection[] | undefined,
): LeftSidebarPersonalSectionConfig[] => {
  const legacyByName = new Map(sections.map((s) => [s.text, s]));
  return (personalValues ?? []).map((snap) => {
    const legacy = legacyByName.get(snap.name);
    const legacyChildByPageUid = new Map(
      (legacy?.children ?? []).map((c) => [c.text, c]),
    );
    return {
      uid: legacy?.uid ?? "",
      text: snap.name,
      settings: {
        uid: legacy?.settings?.uid ?? "",
        truncateResult: {
          uid: legacy?.settings?.truncateResult.uid ?? "",
          value: snap.Settings["Truncate-result?"],
        },
        folded: {
          uid: legacy?.settings?.folded.uid ?? "",
          value: snap.Settings.Folded,
        },
        alias: {
          uid: legacy?.settings?.alias?.uid,
          valueUid: legacy?.settings?.alias?.valueUid,
          value: snap.Settings.Alias,
        },
        resultLimit: {
          uid: legacy?.settings?.resultLimit?.uid,
          value: snap.Settings["Result-limit"],
        },
      },
      children:
        snap.Children.length > 0
          ? snap.Children.map((snapChild) => {
              const legacyChild = legacyChildByPageUid.get(snapChild.uid);
              return {
                uid: legacyChild?.uid ?? "",
                text: snapChild.uid,
                children: legacyChild?.children ?? [],
                alias: {
                  uid: legacyChild?.alias.uid,
                  value: snapChild.Alias,
                },
              };
            })
          : [],
      childrenUid: legacy?.childrenUid,
    };
  });
};

export const getLeftSidebarSettings = (
  globalTree: RoamBasicNode[],
): LeftSidebarConfig => {
  const leftSidebarNode = globalTree.find(
    (node) => node.text === "Left Sidebar",
  );
  const leftSidebarUid = leftSidebarNode?.uid || "";
  const leftSidebarChildren = leftSidebarNode?.children || [];
  const global = getLeftSidebarGlobalSectionConfig(leftSidebarChildren);
  const personal = getLeftSidebarPersonalSectionConfig(leftSidebarChildren);
  // TODO: remove this on complete migration task [ENG-1171: Remove `migrateLeftSideBarSettings`](https://linear.app/discourse-graphs/issue/ENG-1171/remove-migrateleftsidebarsettings)
  const allPersonalSections =
    getAllLeftSidebarPersonalSectionConfigs(leftSidebarChildren);
  const favoritesMigrated = getUidAndBooleanSetting({
    tree: leftSidebarChildren,
    text: "Favorites Migrated",
  });
  const sidebarMigrated = getUidAndBooleanSetting({
    tree: leftSidebarChildren,
    text: "Sidebar Migrated",
  });
  const currentUserUid = window.roamAlphaAPI.user.uid();
  const globalSectionFolded: BooleanSetting = currentUserUid
    ? getUidAndBooleanSetting({
        tree: leftSidebarChildren,
        text: getGlobalSectionFoldedMarkerText(currentUserUid),
      })
    : { uid: undefined, value: false };
  return {
    uid: leftSidebarUid,
    favoritesMigrated,
    sidebarMigrated,
    global,
    globalSectionFolded,
    personal,
    allPersonalSections,
  };
};
