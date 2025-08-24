import type { RoamBasicNode } from "roamjs-components/types";
import {
  getExportSettingsAndUids,
  StringSetting,
  ExportConfigWithUids,
  getUidAndStringSetting,
} from "./getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  LeftSidebarConfig,
  getLeftSidebarSettings,
} from "./getLeftSidebarSettings";

const configTreeRef: {
  tree: RoamBasicNode[];
  nodes: { [uid: string]: { text: string; children: RoamBasicNode[] } };
} = { tree: [], nodes: {} };

export type FormattedConfigTree = {
  settingsUid: string;
  grammarUid: string;
  relationsUid: string;
  nodesUid: string;
  trigger: StringSetting;
  export: ExportConfigWithUids;
  canvasPageFormat: StringSetting;
  leftSidebar: LeftSidebarConfig;
};

export const getFormattedConfigTree = (): FormattedConfigTree => {
  const settingsUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  const grammarNode = configTreeRef.tree.find(
    (node) => node.text === "grammar",
  );
  const relationsNode = grammarNode?.children.find(
    (node) => node.text === "relations",
  );
  const nodesNode = grammarNode?.children.find((node) => node.text === "nodes");

  return {
    settingsUid,
    grammarUid: grammarNode?.uid || "",
    relationsUid: relationsNode?.uid || "",
    nodesUid: nodesNode?.uid || "",
    trigger: getUidAndStringSetting({
      tree: configTreeRef.tree,
      text: "trigger",
    }),
    export: getExportSettingsAndUids(),
    canvasPageFormat: getUidAndStringSetting({
      tree: configTreeRef.tree,
      text: "Canvas Page Format",
    }),
    leftSidebar: getLeftSidebarSettings(configTreeRef.tree),
  };
};
export default configTreeRef;
