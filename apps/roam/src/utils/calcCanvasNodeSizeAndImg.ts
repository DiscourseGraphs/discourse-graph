import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { OnloadArgs, TreeNode } from "roamjs-components/types";
import { MAX_WIDTH } from "~/components/canvas/Tldraw";
import { measureCanvasNodeText } from "./measureCanvasNodeText";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import runQuery from "./runQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import resolveRefs from "roamjs-components/dom/resolveRefs";
import { render as renderToast } from "roamjs-components/components/Toast";
import { loadImage } from "./loadImage";
import { DEFAULT_STYLE_PROPS } from "~/components/canvas/DiscourseNodeUtil";

const extractFirstImageUrl = (text: string): string | null => {
  const regex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
  const result = text.match(regex) || resolveRefs(text).match(regex);
  return result ? result[1] : null;
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
  } catch {
    renderToast({
      id: "tldraw-image-load-fail",
      content: "Failed to load image",
      intent: "warning",
    });
    return { w, h, imageUrl: "" };
  }
};

export default calcCanvasNodeSizeAndImg;
