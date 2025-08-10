import { getSubTree } from "roamjs-components/util";
import { BooleanSetting, getUidAndBooleanSetting } from "./getExportSettings";
import { RoamBasicNode } from "roamjs-components/types";

export type SuggestiveModeConfigWithUids = {
  parentUid: string;
  grabFromReferencedPages: BooleanSetting;
  grabParentAndChildren: BooleanSetting;
  pageGroups: {
    uid: string;
    name: string;
    pages: { uid: string; name: string }[];
  };
};

export const getSuggestiveModeConfigAndUids =
  (tree: RoamBasicNode[]): SuggestiveModeConfigWithUids => {
    const suggestiveModeNode = getSubTree({
      tree,
      key: "Suggestive mode",
    });
    const pageGroupsNode = getSubTree({
      parentUid: suggestiveModeNode.uid,
      key: "Page Groups",
    });

    return {
      parentUid: suggestiveModeNode.uid,
      grabFromReferencedPages: getUidAndBooleanSetting({
        tree: suggestiveModeNode.children,
        text: "Include Current Page Relations",
      }),
      grabParentAndChildren: getUidAndBooleanSetting({
        tree: suggestiveModeNode.children,
        text: "Include Parent And Child Blocks",
      }),
      pageGroups: {
        uid: pageGroupsNode?.uid || "",
        name: "Page Groups",
        pages: [],
      },
    };
  };
