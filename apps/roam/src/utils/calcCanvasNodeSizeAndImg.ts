import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { OnloadArgs, TreeNode } from "roamjs-components/types";
import { DEFAULT_STYLE_PROPS, MAX_WIDTH } from "~/components/canvas/Tldraw";
import { measureCanvasNodeText } from "./measureCanvasNodeText";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import runQuery from "./runQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import resolveRefs from "roamjs-components/dom/resolveRefs";
import { render as renderToast } from "roamjs-components/components/Toast";
import { loadImage } from "./loadImage";
import sendErrorEmail from "./sendErrorEmail";
import { EMBED_REGEX, EMBED_CHILDREN_REGEX, SIMPLE_BLOCK_REF_REGEX } from "~/data/embedPatterns";

const extractFirstImageUrl = (text: string): string | null => {
  const regex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
  const result = text.match(regex) || resolveRefs(text).match(regex);
  return result ? result[1] : null;
};

const extractBlockUidsFromEmbeds = (text: string): string[] => {
  const uids: string[] = [];
  
  // Extract from embed patterns
  const embedMatch = text.match(EMBED_REGEX);
  if (embedMatch) {
    uids.push(embedMatch[1]);
  }
  
  const embedChildrenMatch = text.match(EMBED_CHILDREN_REGEX);
  if (embedChildrenMatch) {
    uids.push(embedChildrenMatch[1]);
  }
  
  // Extract from simple block references
  const blockRefMatches = text.matchAll(SIMPLE_BLOCK_REF_REGEX);
  for (const match of blockRefMatches) {
    uids.push(match[1]);
  }
  
  return uids;
};

const containsKeyFigure = (text: string): boolean => {
  // Check if the text contains "key figure" (case insensitive)
  return /key\s+figure/i.test(text);
};

const checkForKeyFigureInEmbeds = (nodeText: string, nodeUid: string): boolean => {
  // First check if the node itself contains "key figure"
  if (containsKeyFigure(nodeText)) {
    return true;
  }
  
  // Check if the node's tree contains "key figure"
  const nodeTree = getFullTreeByParentUid(nodeUid);
  const checkTreeForKeyFigure = (node: TreeNode): boolean => {
    if (containsKeyFigure(node.text)) {
      return true;
    }
    return node.children?.some(checkTreeForKeyFigure) || false;
  };
  
  if (checkTreeForKeyFigure(nodeTree)) {
    return true;
  }
  
  // Extract UIDs from embeds and block references
  const embeddedUids = extractBlockUidsFromEmbeds(nodeText);
  
  // Check each embedded/referenced block for "key figure"
  for (const uid of embeddedUids) {
    // Check the referenced block's text
    const referencedText = getTextByBlockUid(uid);
    if (referencedText && containsKeyFigure(referencedText)) {
      return true;
    }
    
    // Check the referenced block's tree
    const referencedTree = getFullTreeByParentUid(uid);
    if (checkTreeForKeyFigure(referencedTree)) {
      return true;
    }
  }
  
  return false;
};

const getFirstImageByUid = (uid: string): string | null => {
  const tree = getFullTreeByParentUid(uid);

  const findFirstImage = (node: TreeNode): string | null => {
    const imageUrl = extractFirstImageUrl(node.text);
    if (imageUrl) return imageUrl;

    if (node.children) {
      for (const child of node.children) {
        const childImageUrl = findFirstImage(child);
        if (childImageUrl) return childImageUrl;
      }
    }

    return null;
  };

  return findFirstImage(tree);
};

const calcCanvasNodeSizeAndImg = async ({
  nodeText,
  uid,
  nodeType,
  extensionAPI,
}: {
  nodeText: string;
  uid: string;
  nodeType: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const allNodes = getDiscourseNodes();
  const canvasSettings = Object.fromEntries(
    allNodes.map((n) => [n.type, { ...n.canvasSettings }]),
  );
  const {
    "query-builder-alias": qbAlias = "",
    "key-image": isKeyImage = "",
    "key-image-option": keyImageOption = "",
  } = canvasSettings[nodeType] || {};

  // Check if this node contains "key figure" in embeds or references
  const hasKeyFigure = checkForKeyFigureInEmbeds(nodeText, uid);
  const displayText = hasKeyFigure ? `${nodeText}\n\n🔑 Key Figure` : nodeText;
  
  const { w, h } = measureCanvasNodeText({
    ...DEFAULT_STYLE_PROPS,
    maxWidth: MAX_WIDTH,
    text: displayText,
  });

  if (!isKeyImage) return { w, h, imageUrl: "" };

  let imageUrl;
  if (keyImageOption === "query-builder") {
    const parentUid = resolveQueryBuilderRef({
      queryRef: qbAlias,
      extensionAPI,
    });
    const results = await runQuery({
      extensionAPI,
      parentUid,
      inputs: { NODETEXT: nodeText, NODEUID: uid },
    });
    const result = results.allProcessedResults[0]?.text || "";
    imageUrl = extractFirstImageUrl(result);
  } else {
    imageUrl = getFirstImageByUid(uid);
  }
  if (!imageUrl) return { w, h, imageUrl: "" };

  const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
  const maxWidth = Number(MAX_WIDTH.replace("px", ""));
  const effectiveWidth = maxWidth - 2 * padding;

  try {
    const { width, height } = await loadImage(imageUrl);
    const aspectRatio = width / height;
    const nodeImageHeight = effectiveWidth / aspectRatio;

    return {
      w,
      h: h + nodeImageHeight + padding * 2,
      imageUrl,
    };
  } catch (e) {
    const error = e as Error;
    sendErrorEmail({
      error,
      type: "Canvas Node Image Load Failed",
      context: {
        uid,
        nodeType,
        imageUrl,
      },
    });
    renderToast({
      id: "tldraw-image-load-fail",
      content: error.message,
      intent: "warning",
    });
    return { w, h, imageUrl: "" };
  }
};

export default calcCanvasNodeSizeAndImg;
