import { getSubTree } from "roamjs-components/util";
import { BooleanSetting, getUidAndBooleanSetting } from "./getExportSettings";
import { RoamBasicNode } from "roamjs-components/types";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

export type PageGroup = {
  uid: string;
  name: string;
  pages: { uid: string; name: string }[];
};
export type SuggestiveModeConfigWithUids = {
  parentUid: string;
  includePageRelations: BooleanSetting;
  includeParentAndChildren: BooleanSetting;
  pageGroups: {
    uid: string;
    groups: PageGroup[];
  };
};

export const getSuggestiveModeConfigAndUids = (
  tree: RoamBasicNode[],
): SuggestiveModeConfigWithUids => {
  const suggestiveModeNode = getSubTree({
    tree,
    key: "Suggestive Mode",
  });
  const pageGroupsNode = getSubTree({
    parentUid: suggestiveModeNode.uid,
    key: "Page Groups",
  });
  const pageGroups = getBasicTreeByParentUid(pageGroupsNode.uid).map(
    (node) => ({
      uid: node.uid,
      name: node.text,
      pages: node.children.map((c) => ({ uid: c.uid, name: c.text })),
    }),
  );

  return {
    parentUid: suggestiveModeNode.uid,
    includePageRelations: getUidAndBooleanSetting({
      tree: suggestiveModeNode.children,
      text: "Include Current Page Relations",
    }),
    includeParentAndChildren: getUidAndBooleanSetting({
      tree: suggestiveModeNode.children,
      text: "Include Parent And Child Blocks",
    }),
    pageGroups: {
      uid: pageGroupsNode.uid,
      groups: pageGroups,
    },
  };
};
