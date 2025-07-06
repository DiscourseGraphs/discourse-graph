import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
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

// Roam embed syntax patterns - same as in getExportTypes.ts
const EMBED_REGEX =
  /{{\[\[(?:embed|embed-path)\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;
const EMBED_CHILDREN_REGEX =
  /{{\[\[embed-children\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;

const extractFirstImageUrl = (text: string): string | null => {
  const regex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
  const result = text.match(regex) || resolveRefs(text).match(regex);
  if (result) return result[1];

  // Check for embeds and search their content
  const embedMatch = text.match(EMBED_REGEX);
  if (embedMatch) {
    const blockUid = embedMatch[1];
    const reference = getFullTreeByParentUid(blockUid);
    return findFirstImageInTree(reference);
  }

  // Check for embed-children and search their content
  const embedChildrenMatch = text.match(EMBED_CHILDREN_REGEX);
  if (embedChildrenMatch) {
    const blockUid = embedChildrenMatch[1];
    const reference = getFullTreeByParentUid(blockUid);
    for (const child of reference.children) {
      const childImageUrl = findFirstImageInTree(child);
      if (childImageUrl) return childImageUrl;
    }
  }

  return null;
};

const findFirstImageInTree = (node: TreeNode): string | null => {
  const imageUrl = extractFirstImageUrl(node.text);
  if (imageUrl) return imageUrl;

  if (node.children) {
    for (const child of node.children) {
      const childImageUrl = findFirstImageInTree(child);
      if (childImageUrl) return childImageUrl;
    }
  }

  return null;
};

const getFirstImageByUid = (uid: string): string | null => {
  const tree = getFullTreeByParentUid(uid);
  return findFirstImageInTree(tree);
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

  const { w, h } = measureCanvasNodeText({
    ...DEFAULT_STYLE_PROPS,
    maxWidth: MAX_WIDTH,
    text: nodeText,
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
