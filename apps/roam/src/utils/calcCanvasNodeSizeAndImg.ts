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

// Matches embed, embed-path, and embed-children syntax:
// {{[[embed]]: ((block-uid)) }}, {{[[embed-path]]: ((block-uid)) }}, {{[[embed-children]]: ((block-uid)) }}
// Also handles multiple parentheses: {{[[embed]]: ((((block-uid)))) }}
const EMBED_REGEX =
  /{{\[\[(?:embed|embed-path|embed-children)\]\]:\s*\(\(+([^)]+?)\)+\)\s*}}/i;

const getBlockReferences = (
  uid: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
): { ":block/uid"?: string; ":block/string"?: string }[] => {
  const result =
    (window.roamAlphaAPI?.pull?.(
      "[:block/uid {:block/refs [:block/uid :block/string]}]",
      [":block/uid", uid],
    ) as {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      [":block/refs"]?: { ":block/uid"?: string; ":block/string"?: string }[];
    } | null) || {};
  return result[":block/refs"] || [];
};

const findFirstImage = (
  node: TreeNode,
  visited = new Set<string>(),
): string | null => {
  if (visited.has(node.uid)) return null;
  visited.add(node.uid);

  const imageUrl = extractFirstImageUrl(node.text);
  if (imageUrl) return imageUrl;

  const embedUid = node.text.match(EMBED_REGEX)?.[1];
  if (embedUid && !visited.has(embedUid)) {
    const embedTree = getFullTreeByParentUid(embedUid);
    const embedImageUrl = findFirstImage(embedTree, visited);
    if (embedImageUrl) return embedImageUrl;
  }

  const references = getBlockReferences(node.uid);
  for (const reference of references) {
    const referenceText = reference[":block/string"] || "";
    const referenceImage = extractFirstImageUrl(referenceText);
    if (referenceImage) return referenceImage;
  }

  if (node.children) {
    for (const child of node.children) {
      const childImageUrl = findFirstImage(child, visited);
      if (childImageUrl) return childImageUrl;
    }
  }

  return null;
};

const getFirstImageByUid = (uid: string): string | null => {
  const tree = getFullTreeByParentUid(uid);
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      inputs: { NODETEXT: nodeText, NODEUID: uid },
    });
    const resultUid = results.allProcessedResults[0]?.uid || "";
    imageUrl = getFirstImageByUid(resultUid);
  } else {
    imageUrl = getFirstImageByUid(uid);
  }
  if (!imageUrl) return { w, h, imageUrl: "" };

  try {
    const { width, height } = await loadImage(imageUrl);
    if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) {
      return { w, h, imageUrl: "" };
    }
    
    const aspectRatio = width / height;
    const nodeImageHeight = w / aspectRatio;
    const newHeight = h + nodeImageHeight;

    return { w, h: newHeight, imageUrl };
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
