import { render as renderToast } from "roamjs-components/components/Toast";
import createBlock from "roamjs-components/writes/createBlock";
import stripUid from "roamjs-components/util/stripUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getDiscourseNodes from "./getDiscourseNodes";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import { OnloadArgs, RoamBasicNode } from "roamjs-components/types";
import runQuery from "./runQuery";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";

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

      const parentUid = resolveQueryBuilderRef({
        queryRef: qbAlias,
        extensionAPI,
      });
      const results = await runQuery({
        extensionAPI,
        parentUid,
        // eslint-disable-next-line @typescript-eslint/naming-convention
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
  templateNode,
  pageUid,
  order = 0,
  discourseNodes,
  configPageUid,
  imageUrl,
  extensionAPI,
  text,
}: {
  templateNode: RoamBasicNode;
  pageUid: string;
  order?: number;
  discourseNodes: ReturnType<typeof getDiscourseNodes>;
  configPageUid: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
  text: string;
}) => {
  const createBlocksFromTemplate = async () => {
    await Promise.all(
      stripUid(templateNode.children).map((node, templateOrder) =>
        createBlock({
          node,
          order: order + templateOrder,
          parentUid: pageUid,
        }),
      ),
    );

    // Add image to page if imageUrl is provided
    await handleImageCreation({
      pageUid,
      discourseNodes,
      configPageUid,
      imageUrl,
      extensionAPI,
      text,
    });
  };

  const hasSmartBlockSyntax = (node: RoamBasicNode) => {
    if (node.text.includes("<%")) return true;
    if (node.children) return node.children.some(hasSmartBlockSyntax);
    return false;
  };
  const useSmartBlocks = hasSmartBlockSyntax(templateNode);

  if (useSmartBlocks && !window.roamjs?.extension?.smartblocks) {
    renderToast({
      content:
        "This template requires SmartBlocks. Enable SmartBlocks in Roam Depot to use this template.",
      id: "smartblocks-extension-disabled",
      intent: "warning",
    });
    await createBlocksFromTemplate();
  } else if (useSmartBlocks && window.roamjs?.extension?.smartblocks) {
    void window.roamjs.extension.smartblocks?.triggerSmartblock({
      srcUid: templateNode.uid,
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
    await createBlocksFromTemplate();
  }
};

type Props = {
  text: string;
  configPageUid: string;
  newPageUid?: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
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
    if (extensionAPI?.settings.get("disable-sidebar-open")) return;
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

  const nodeTree = getFullTreeByParentUid(configPageUid).children;
  const templateNode = getSubTree({
    tree: nodeTree,
    key: "template",
  });

  await createBlocksFromTemplate({
    templateNode,
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
