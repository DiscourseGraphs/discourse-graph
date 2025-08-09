import type { RoamBasicNode } from "roamjs-components/types";
import {
  getExportSettingsAndUids,
  StringSetting,
  ExportConfigWithUids,
  getUidAndStringSetting,
  BooleanSetting,
  getUidAndBooleanSetting,
} from "./getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getSubTree } from "roamjs-components/util";

const configTreeRef: {
  tree: RoamBasicNode[];
  nodes: { [uid: string]: { text: string; children: RoamBasicNode[] } };
} = { tree: [], nodes: {} };

type SuggestiveModeConfigWithUids = {
  parentUid: string;
  grabFromReferencedPages: BooleanSetting;
  grabParentAndChildren: BooleanSetting;
  pageGroups: {
    uid: string;
    name: string;
    pages: { uid: string; name: string }[];
  };
};

const getSuggestiveModeConfigAndUids = (): SuggestiveModeConfigWithUids => {
  const suggestiveModeNode = getSubTree({
    tree: configTreeRef.tree,
    key: "suggestive-mode",
  });
  const pageGroupsNode = suggestiveModeNode.children.find(
    (node) => node.text === "Page Groups",
  );

  return {
    parentUid: suggestiveModeNode.uid,
    grabFromReferencedPages: getUidAndBooleanSetting({
      tree: suggestiveModeNode.children,
      text: "Include Current Page Relations",
    }),
    grabParentAndChildren: getUidAndBooleanSetting({
      tree: suggestiveModeNode.children,
      text: "Include Parent and Child Blocks",
    }),
    pageGroups: {
      uid: pageGroupsNode?.uid || "",
      name: "page groups",
      pages: [],
    },
  };
};

type FormattedConfigTree = {
  settingsUid: string;
  grammarUid: string;
  relationsUid: string;
  nodesUid: string;
  trigger: StringSetting;
  export: ExportConfigWithUids;
  canvasPageFormat: StringSetting;
  suggestiveMode: SuggestiveModeConfigWithUids;
};

export const getFormattedConfigTree = (): FormattedConfigTree => {
  const settingsUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  console.log("settingsUid", settingsUid);
  const grammarNode = configTreeRef.tree.find(
    (node) => node.text === "grammar",
  );
  console.log("grammarNode", grammarNode);
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
    suggestiveMode: getSuggestiveModeConfigAndUids(),
  };
};
export default configTreeRef;
