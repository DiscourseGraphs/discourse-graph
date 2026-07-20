import { render as renderToast } from "roamjs-components/components/Toast";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getDiscourseNodes from "./getDiscourseNodes";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import { InputTextNode, OnloadArgs } from "roamjs-components/types";
import runQuery from "./runQuery";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import {
  getDiscourseNodeSetting,
  getPersonalSetting,
} from "~/components/settings/utils/accessors";
import {
  DISCOURSE_NODE_KEYS,
  PERSONAL_KEYS,
} from "~/components/settings/utils/settingKeys";

type Props = {
  text: string;
  configPageUid: string;
  newPageUid?: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
};

const stripTemplateUids = (nodes: InputTextNode[]): InputTextNode[] =>
  nodes.map((node) => {
    const nodeWithoutUid = { ...node };
    const { children } = nodeWithoutUid;
    delete nodeWithoutUid.uid;
    delete nodeWithoutUid.children;
    return {
      ...nodeWithoutUid,
      ...(children?.length ? { children: stripTemplateUids(children) } : {}),
    };
  });

const handleImageCreation = async ({
  pageUid,
  discourseNodes,
  configPageUid,
  imageUrl,
  extensionAPI,
  text,
}: {
  pageUid: string;
  discourseNodes: ReturnType<typeof getDiscourseNodes>;
  configPageUid: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
  text: string;
}) => {
  const canvasSettings = Object.fromEntries(
    discourseNodes.map((n) => [n.type, { ...n.canvasSettings }]),
  );
  const {
    "query-builder-alias": qbAlias = "",
    "key-image": isKeyImage = "",
    "key-image-option": keyImageOption = "",
  } = canvasSettings[configPageUid] || {};

  if (isKeyImage && imageUrl) {
    const createOrUpdateImageBlock = async (imagePlaceholderUid?: string) => {
      const imageMarkdown = `![](${imageUrl})`;
      if (imagePlaceholderUid) {
        await updateBlock({
          uid: imagePlaceholderUid,
          text: imageMarkdown,
        });
      } else {
        await createBlock({
          node: { text: imageMarkdown },
          order: 0,
          parentUid: pageUid,
        });
      }
    };

    if (keyImageOption === "query-builder") {
      if (!extensionAPI) return;

      const parentUid = resolveQueryBuilderRef({ queryRef: qbAlias });
      const results = await runQuery({
        extensionAPI,
        parentUid,
        inputs: { NODETEXT: text, NODEUID: pageUid },
      });
      const imagePlaceholderUid = results.allProcessedResults[0]?.uid;
      await createOrUpdateImageBlock(imagePlaceholderUid);
    } else {
      await createOrUpdateImageBlock();
    }
  }
};

export const createBlocksFromTemplate = async ({
  templateChildren,
  pageUid,
  order = 0,
  discourseNodes,
  configPageUid,
  imageUrl,
  extensionAPI,
  text,
}: {
  templateChildren: InputTextNode[];
  pageUid: string;
  order?: number;
  discourseNodes: ReturnType<typeof getDiscourseNodes>;
  configPageUid: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
  text: string;
}) => {
  const createBlocks = async () => {
    await Promise.all(
      stripTemplateUids(templateChildren).map((node, templateOrder) =>
        createBlock({
          node,
          order: order + templateOrder,
          parentUid: pageUid,
        }),
      ),
    );

    await handleImageCreation({
      pageUid,
      discourseNodes,
      configPageUid,
      imageUrl,
      extensionAPI,
      text,
    });
  };

  const hasSmartBlockSyntax = (node: InputTextNode): boolean => {
    if (node.text.includes("<%")) return true;
    if (node.children) return node.children.some(hasSmartBlockSyntax);
    return false;
  };
  const useSmartBlocks = templateChildren.some(hasSmartBlockSyntax);
  const legacyTemplateNode = getSubTree({
    tree: getFullTreeByParentUid(configPageUid).children,
    key: "template",
  });
  const canUseLegacySmartBlock = !!legacyTemplateNode.uid;

  if (useSmartBlocks && !window.roamjs?.extension?.smartblocks) {
    renderToast({
      content:
        "This template requires SmartBlocks. Enable SmartBlocks in Roam Depot to use this template.",
      id: "smartblocks-extension-disabled",
      intent: "warning",
    });
    await createBlocks();
  } else if (
    useSmartBlocks &&
    canUseLegacySmartBlock &&
    window.roamjs?.extension?.smartblocks
  ) {
    void window.roamjs.extension.smartblocks?.triggerSmartblock({
      srcUid: legacyTemplateNode.uid,
      targetUid: pageUid,
    });
    await handleImageCreation({
      pageUid,
      discourseNodes,
      configPageUid,
      imageUrl,
      extensionAPI,
      text,
    });
  } else {
    await createBlocks();
  }
};

const createDiscourseNode = async ({
  text,
  configPageUid,
  newPageUid,
  imageUrl,
  extensionAPI,
}: Props) => {
  posthog.capture("Discourse Node: Created", {
    text: text,
  });
  const handleOpenInSidebar = (uid: string) => {
    const disableSidebarOpen = getPersonalSetting<boolean>([
      PERSONAL_KEYS.disableSidebarOpen,
    ]);
    if (disableSidebarOpen === true) {
      renderToast({
        id: "sidebar-open-disabled",
        content: "Node created (sidebar open disabled in settings)",
        intent: "primary",
        timeout: 2000,
      });
      return;
    }
    void openBlockInSidebar(uid);
    setTimeout(() => {
      const sidebarTitle = document.querySelector(
        ".rm-sidebar-outline .rm-title-display",
      );
      sidebarTitle?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
      setTimeout(() => {
        const ta = document.activeElement as HTMLTextAreaElement;
        if (ta.tagName === "TEXTAREA") {
          const index = ta.value.length;
          ta.setSelectionRange(index, index);
        }
      }, 1);
    }, 100);
  };

  const discourseNodes = getDiscourseNodes();
  const specification = discourseNodes?.find(
    (n) => n.type === configPageUid,
  )?.specification;
  // This handles blck-type and creates block in the DNP
  // but could have unintended consequences for other defined discourse nodes
  if (
    specification?.find(
      (spec) => spec.type === "clause" && spec.relation === "is in page",
    )
  ) {
    const blockUid = await createBlock({
      // TODO: for canvas, create in `Auto generated from ${title}`
      parentUid: window.roamAlphaAPI.util.dateToPageUid(new Date()),
      node: { text, uid: newPageUid },
    });
    handleOpenInSidebar(blockUid);
    return blockUid;
  }

  let pageUid: string;
  let isNewPage = false;

  if (newPageUid) {
    await createPage({ title: text, uid: newPageUid });
    pageUid = newPageUid;
    isNewPage = true;
  } else {
    const existingPageUid = getPageUidByPageTitle(text);
    if (existingPageUid) {
      pageUid = existingPageUid;
      isNewPage = false;
    } else {
      pageUid = await createPage({ title: text });
      isNewPage = true;
    }
  }

  // Skip template creation if the page already exists and has children
  const existingChildren = getFullTreeByParentUid(pageUid).children || [];
  if (!isNewPage && existingChildren.length > 0) {
    handleOpenInSidebar(pageUid);
    return pageUid;
  }

  const templateChildren =
    getDiscourseNodeSetting<InputTextNode[]>(configPageUid, [
      DISCOURSE_NODE_KEYS.template,
    ]) ?? [];

  await createBlocksFromTemplate({
    templateChildren,
    pageUid,
    discourseNodes,
    configPageUid,
    imageUrl,
    extensionAPI,
    text,
  });
  handleOpenInSidebar(pageUid);
  return pageUid;
};

export default createDiscourseNode;
