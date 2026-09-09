import { createShapeId, Editor, TLImageShape, TLShape } from "tldraw";
import type { OnloadArgs } from "roamjs-components/types";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { DISCOURSE_NODE_SHAPE_TYPE } from "./DiscourseNodeUtil";

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
