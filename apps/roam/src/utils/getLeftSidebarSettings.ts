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

type LeftSidebarPersonalSectionSettings = {
  uid: string;
  truncateResult: IntSetting;
  folded: BooleanSetting;
  alias: StringSetting | null;
};

export type LeftSidebarPersonalSectionConfig = {
  uid: string;
  text: string;
  sectionWithoutSettingsAndChildren: boolean;
  settings?: LeftSidebarPersonalSectionSettings;
  children?: RoamBasicNode[];
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
  global: LeftSidebarGlobalSectionConfig;
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

  const aliasString = getUidAndStringSetting({
    tree: settingsTree,
    text: "Alias",
  });
  const alias =
    aliasString.value === "Alias" ||
    (aliasString.value === "" && aliasString.uid)
      ? null
      : aliasString;

  return {
    uid: settingsNode.uid,
    truncateResult: truncateResultSetting,
    folded: foldedSetting,
    alias,
  };
};

export const getLeftSidebarPersonalSectionConfig = (
  leftSidebarChildren: RoamBasicNode[],
): { uid: string; sections: LeftSidebarPersonalSectionConfig[] } => {
  const userUid = window.roamAlphaAPI.user.uid();

  const personalLeftSidebarNode = getSubTree({
    tree: leftSidebarChildren,
    key: userUid + "/Personal-Section",
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

      const sectionWithoutSettingsAndChildren = !settingsNode && !childrenNode;

      if (sectionWithoutSettingsAndChildren) {
        return {
          uid: sectionNode.uid,
          text: sectionNode.text,
          sectionWithoutSettingsAndChildren: true,
        };
      } else {
        return {
          uid: sectionNode.uid,
          text: sectionNode.text,
          settings: settingsNode
            ? getPersonalSectionSettings(settingsNode)
            : undefined,
          children: childrenNode?.children || [],
          childrenUid: childrenNode?.uid || "",
          sectionWithoutSettingsAndChildren: false,
        };
      }
    },
  );

  return {
    uid: personalLeftSidebarNode.uid,
    sections,
  };
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
  return {
    uid: leftSidebarUid,
    global,
    personal,
  };
};
