import { RoamBasicNode } from "roamjs-components/types";
import {
  BooleanSetting,
  getUidAndBooleanSetting,
  getUidAndStringSetting,
  IntSetting,
  getUidAndIntSetting,
  StringSetting,
} from "./getExportSettings";
import { getSubTree } from "roamjs-components/util";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

export type LeftSidebarPersonalSectionSettings = {
  uid: string;
  truncateResult: IntSetting;
  collapsable: BooleanSetting;
  open: BooleanSetting;
  alias: StringSetting | null;
};

export type LeftSidebarPersonalSectionConfig = {
  uid: string;
  text: string;
  isSimple: boolean;
  settings?: LeftSidebarPersonalSectionSettings;
  children?: RoamBasicNode[];
  childrenUid?: string;
};

export type LeftSidebarGlobalSectionConfig = {
  uid: string;
  open: BooleanSetting;
  children: RoamBasicNode[];
  childrenUid: string;
};

export type LeftSidebarConfig = {
  global: LeftSidebarGlobalSectionConfig;
  personal: {
    uid: string;
    sections: LeftSidebarPersonalSectionConfig[];
  };
};

export const getLeftSidebarSettings = (
  globalTree: RoamBasicNode[],
): LeftSidebarConfig => {
  const leftSidebarNode = globalTree.find(
    (node) => node.text === "Left Sidebar",
  );
  const leftSidebarChildren = leftSidebarNode?.children || [];
  const userName = getCurrentUserDisplayName();

  const personalLeftSidebarNode = getSubTree({
    tree: leftSidebarChildren,
    key: userName + "/Personal Section",
  });

  const global = getLeftSidebarGlobalSectionConfig(leftSidebarChildren);
  const personal = getLeftSidebarPersonalSectionConfig(personalLeftSidebarNode);

  return {
    global,
    personal,
  };
};

export const getLeftSidebarGlobalSectionConfig = (
  leftSidebarChildren: RoamBasicNode[],
): LeftSidebarGlobalSectionConfig => {
  const globalSectionNode = leftSidebarChildren.find(
    (node) => node.text === "Global Section",
  );
  const globalChildren = globalSectionNode?.children || [];

  const getBoolean = (text: string) =>
    getUidAndBooleanSetting({ tree: globalChildren, text });

  const childrenNode = globalChildren.find((node) => node.text === "Children");

  return {
    uid: globalSectionNode?.uid || "",
    open: getBoolean("Open"),
    children: childrenNode?.children || [],
    childrenUid: childrenNode?.uid || "",
  };
};

export const getLeftSidebarPersonalSectionConfig = (
  personalContainerNode: RoamBasicNode,
): { uid: string; sections: LeftSidebarPersonalSectionConfig[] } => {
  const sections = (personalContainerNode?.children || []).map(
    (sectionNode): LeftSidebarPersonalSectionConfig => {
      const hasSettings = sectionNode.children?.some(
        (child) => child.text === "Settings",
      );
      const childrenNode = sectionNode.children?.find(
        (child) => child.text === "Children",
      );

      const isSimple = !hasSettings && !childrenNode;

      if (isSimple) {
        return {
          uid: sectionNode.uid,
          text: sectionNode.text,
          isSimple: true,
        };
      } else {
        return {
          uid: sectionNode.uid,
          text: sectionNode.text,
          isSimple: false,
          settings: getPersonalSectionSettings(sectionNode),
          children: childrenNode?.children || [],
          childrenUid: childrenNode?.uid || "",
        };
      }
    },
  );

  return {
    uid: personalContainerNode?.uid || "",
    sections,
  };
};

export const getPersonalSectionSettings = (
  personalSectionNode: RoamBasicNode,
): LeftSidebarPersonalSectionSettings => {
  const settingsNode = personalSectionNode.children?.find(
    (node) => node.text === "Settings",
  );
  const settingsTree = settingsNode?.children || [];

  const getInt = (text: string) =>
    getUidAndIntSetting({ tree: settingsTree, text });
  const getBoolean = (text: string) =>
    getUidAndBooleanSetting({ tree: settingsTree, text });
  const getString = (text: string) =>
    getUidAndStringSetting({ tree: settingsTree, text });

  const truncateResultSetting = getInt("Truncate-result?");
  if (!settingsNode?.uid || !truncateResultSetting.uid) {
    truncateResultSetting.value = 75;
  }

  const collapsableSetting = getBoolean("Collapsable?");
  if (!settingsNode?.uid || !collapsableSetting.uid) {
    collapsableSetting.value = false;
  }

  const openSetting = getBoolean("Open?");
  if (!settingsNode?.uid || !openSetting.uid) {
    openSetting.value = false;
  }

  const aliasString = getString("Alias");
  const alias =
    aliasString.value === "Alias" ||
    (aliasString.value === "" && aliasString.uid)
      ? null
      : aliasString;

  return {
    uid: settingsNode?.uid || "",
    truncateResult: truncateResultSetting,
    collapsable: collapsableSetting,
    open: openSetting,
    alias,
  };
};
