import { RoamBasicNode } from "roamjs-components/types";
import {
  BooleanSetting,
  getUidAndBooleanSetting,
  IntSetting,
  getUidAndIntSetting,
  StringSetting,
  getUidAndStringSetting,
} from "./getExportSettings";
import { getSubTree } from "roamjs-components/util";

type LeftSidebarPersonalSectionSettings = {
  uid: string;
  truncateResult: IntSetting;
  folded: BooleanSetting;
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

type LeftSidebarGlobalSectionSettings = {
  uid: string;
  collapsable: BooleanSetting;
  folded: BooleanSetting;
};

export type LeftSidebarGlobalSectionConfig = {
  uid: string;
  settings?: LeftSidebarGlobalSectionSettings;
  children: RoamBasicNode[];
  childrenUid: string;
};

export type LeftSidebarConfig = {
  uid: string;
  favoritesMigrated: BooleanSetting;
  sidebarMigrated: BooleanSetting;
  global: LeftSidebarGlobalSectionConfig;
  allPersonalSections: AllUsersPersonalSections;
  personal: {
    uid: string;
    sections: LeftSidebarPersonalSectionConfig[];
  };
};

const getGlobalSectionSettings = (
  settingsNode: RoamBasicNode,
): LeftSidebarGlobalSectionSettings => {
  const settingsTree = settingsNode?.children || [];
  const collapsableSetting = getUidAndBooleanSetting({
    tree: settingsTree,
    text: "Collapsable",
  });
  const foldedSetting = getUidAndBooleanSetting({
    tree: settingsTree,
    text: "Folded",
  });
  return {
    uid: settingsNode.uid,
    collapsable: collapsableSetting,
    folded: foldedSetting,
  };
};

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

  const settingsNode = getSubTree({
    tree: globalChildren,
    key: "Settings",
  });
  const settings = settingsNode
    ? getGlobalSectionSettings(settingsNode)
    : undefined;

  return {
    uid: globalSectionNode?.uid || "",
    settings,
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

  return {
    uid: settingsNode.uid,
    truncateResult: truncateResultSetting,
    folded: foldedSetting,
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
  return {
    uid: leftSidebarUid,
    favoritesMigrated,
    sidebarMigrated,
    global,
    personal,
    allPersonalSections,
  };
};
