import { getSubTree } from "roamjs-components/util";
import configTreeRef from "./discourseConfigRef";
import { BooleanSetting, getUidAndBooleanSetting } from "./getExportSettings";

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
  (): SuggestiveModeConfigWithUids => {
    const suggestiveModeNode = getSubTree({
      tree: configTreeRef.tree,
      key: "Suggestive mode",
    });
    const pageGroupsNode = getSubTree({
      parentUid: suggestiveModeNode.uid,
      key: "page groups",
    });

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
