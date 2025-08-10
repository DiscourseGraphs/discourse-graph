import { RoamBasicNode } from "roamjs-components/types";
import {
  BooleanSetting,
  getUidAndBooleanSetting,
  IntSetting,
  getUidAndIntSetting,
} from "./getExportSettings";

export type LeftSidebarPersonalSectionSettings = {
  truncateResult: IntSetting;
  collapsable: BooleanSetting;
  open: BooleanSetting;
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
  tree: RoamBasicNode[],
): LeftSidebarConfig => {
  const leftSidebarNode = tree.find((node) => node.text === "Left Sidebar");
  const leftSidebarChildren = leftSidebarNode?.children || [];

  const global = getLeftSidebarGlobalSectionSettings(leftSidebarChildren);
  const personal = getLeftSidebarPersonalSectionSettings(leftSidebarChildren);

  return {
    global,
    personal,
  };
};

export const getLeftSidebarGlobalSectionSettings = (
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

export const getLeftSidebarPersonalSectionSettings = (
  leftSidebarChildren: RoamBasicNode[],
): { uid: string; sections: LeftSidebarPersonalSectionConfig[] } => {
  const personalSectionNode = leftSidebarChildren.find(
    (node) => node.text === "Personal Section",
  );

  const sections = (personalSectionNode?.children || []).map(
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
    uid: personalSectionNode?.uid || "",
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

  const truncateResultSetting = getInt("Truncate-result?");
  if (!settingsNode?.uid || !truncateResultSetting.uid) {
    truncateResultSetting.value = 75;
  }

  const collapsableSetting = getBoolean("Collapsable?");
  if (!settingsNode?.uid || !collapsableSetting.uid) {
    collapsableSetting.value = true;
  }

  const openSetting = getBoolean("Open?");
  if (!settingsNode?.uid || !openSetting.uid) {
    openSetting.value = true;
  }

  return {
    truncateResult: truncateResultSetting,
    collapsable: collapsableSetting,
    open: openSetting,
  };
};
