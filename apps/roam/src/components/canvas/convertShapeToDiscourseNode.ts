import {
  createShapeId,
  Editor,
  isShapeId,
  TLImageShape,
  TLShape,
} from "tldraw";
import type { OnloadArgs } from "roamjs-components/types";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { DISCOURSE_NODE_SHAPE_TYPE } from "./DiscourseNodeUtil";

const TEXT_SHAPE_TYPES = ["text", "geo", "note"];

export const getShapeText = (shape: TLShape): string =>
  "text" in shape.props ? shape.props.text : "";

export const isConvertibleShape = (shape?: TLShape | null): boolean => {
  if (!shape || shape.isLocked) return false;
  if (shape.type === "image") return true;
  if (!TEXT_SHAPE_TYPES.includes(shape.type)) return false;
  // Geo and note shapes convert only when they carry text.
  return shape.type === "text" || !!getShapeText(shape).trim();
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
  const { x, y, parentId } = shape;
  const pagePoint = editor.getShapePageTransform(shape.id).point();
  // Size before deleting so a failed key-image query leaves the source shape in place
  const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
    nodeText: text,
    extensionAPI,
    nodeType,
    uid,
  });
  editor.deleteShapes([shape.id]);
  // Deleting a child of a two-shape group dissolves that group, so re-check the parent.
  const keepsParent = isShapeId(parentId) && !!editor.getShape(parentId);
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
      // x/y are parent-relative; without parentId tldraw reads them as page coordinates.
      ...(keepsParent
        ? { parentId, x, y }
        : { x: pagePoint.x, y: pagePoint.y }),
    },
  ]);
};
