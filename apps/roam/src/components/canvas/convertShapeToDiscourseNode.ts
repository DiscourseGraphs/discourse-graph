import { createShapeId, Editor, TLImageShape, TLShape } from "tldraw";
import type { OnloadArgs } from "roamjs-components/types";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { DISCOURSE_NODE_SHAPE_TYPE } from "./DiscourseNodeUtil";

const TEXT_SHAPE_TYPES = ["text", "geo", "note"];

export const getConvertibleShapeText = (
  shape?: TLShape | null,
): string | null => {
  if (!shape || shape.isLocked) return null;
  if (shape.type === "image") return "";
  if (!TEXT_SHAPE_TYPES.includes(shape.type)) return null;
  if (!("text" in shape.props)) return null;
  const text = shape.props.text.trim();
  // Geo and note shapes convert only when they carry text.
  return shape.type === "text" || text ? text : null;
};

export const uploadImageShapeToRoam = async ({
  editor,
  shape,
}: {
  editor: Editor;
  shape: TLImageShape;
}): Promise<string | undefined> => {
  const { assetId } = shape.props;
  if (!assetId) return undefined;
  const asset = editor.getAsset(assetId);
  if (!asset || !asset.props.src) return undefined;
  // Dropped and pasted files are already uploaded to Roam by the canvas handlers
  if (asset.props.src.startsWith("https:")) return asset.props.src;
  const file = await fetch(asset.props.src)
    .then((r) => r.arrayBuffer())
    .then((buf) => new File([buf], shape.id));
  return window.roamAlphaAPI.util.uploadFile({ file });
};

export const replaceShapeWithDiscourseNode = async ({
  editor,
  extensionAPI,
  shape,
  nodeType,
  text,
  uid,
}: {
  editor: Editor;
  extensionAPI: OnloadArgs["extensionAPI"];
  shape: TLShape;
  nodeType: string;
  text: string;
  uid: string;
}): Promise<void> => {
  const { x, y } = shape;
  editor.deleteShapes([shape.id]);
  const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
    nodeText: text,
    extensionAPI,
    nodeType,
    uid,
  });
  editor.createShapes([
    {
      type: DISCOURSE_NODE_SHAPE_TYPE,
      id: createShapeId(),
      props: {
        uid,
        title: text,
        h,
        w,
        imageUrl,
        fontFamily: "sans",
        size: "s",
        nodeTypeId: nodeType,
      },
      x,
      y,
    },
  ]);
};
