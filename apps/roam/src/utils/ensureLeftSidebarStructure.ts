import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { getLeftSidebarPersonalSectionConfig } from "./getLeftSidebarSettings";
import { getLeftSidebarGlobalSectionConfig } from "./getLeftSidebarSettings";
import { LeftSidebarConfig } from "./getLeftSidebarSettings";
import { RoamBasicNode } from "roamjs-components/types";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import { getSubTree } from "roamjs-components/util";
import refreshConfigTree from "~/utils/refreshConfigTree";

export const ensureLeftSidebarStructure = async (): Promise<void> => {
  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  const configTree = getBasicTreeByParentUid(configPageUid);
  const userName = getCurrentUserDisplayName();

  let sidebarNode = configTree.find((n) => n.text === "Left Sidebar");

  if (!sidebarNode) {
    await createBlock({
      parentUid: configPageUid,
      node: {
        text: "Left Sidebar",
        children: [
          {
            text: "Global Section",
            children: [
              { text: "Open", children: [{ text: "false" }] },
              { text: "Children" },
            ],
          },
          {
            text: userName + "/Personal Section",
          },
        ],
      },
    });
  } else {
    const hasGlobalSection = sidebarNode.children?.some(
      (n) => n.text === "Global Section",
    );
    const hasPersonalSection = sidebarNode.children?.some(
      (n) => n.text === userName + "/Personal Section",
    );

    if (!hasGlobalSection) {
      await createBlock({
        parentUid: sidebarNode.uid,
        order: 0,
        node: {
          text: "Global Section",
          children: [
            { text: "Open", children: [{ text: "false" }] },
            { text: "Children" },
          ],
        },
      });
    }

    if (!hasPersonalSection) {
      await createBlock({
        parentUid: sidebarNode.uid,
        node: { text: userName + "/Personal Section" },
      });
    }
  }
};

let ensureLeftSidebarReadyPromise: Promise<void> | null = null;

export const ensureLeftSidebarReady = (): Promise<void> => {
  if (!ensureLeftSidebarReadyPromise) {
    ensureLeftSidebarReadyPromise = (async () => {
      await ensureLeftSidebarStructure();
      refreshConfigTree();
    })().catch((e) => {
      ensureLeftSidebarReadyPromise = null;
      throw e;
    });
  }
  return ensureLeftSidebarReadyPromise;
};

export const getLeftSidebarSettingsWithDefaults = (
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

  const global = getLeftSidebarGlobalSectionConfig(leftSidebarChildren) || {
    uid: "",
    open: { uid: "", value: false },
    children: [],
    childrenUid: "",
  };

  const personal = getLeftSidebarPersonalSectionConfig(
    personalLeftSidebarNode,
  ) || {
    uid: "",
    text: "",
    isSimple: true,
    sections: [],
  };

  return {
    global,
    personal,
  };
};
