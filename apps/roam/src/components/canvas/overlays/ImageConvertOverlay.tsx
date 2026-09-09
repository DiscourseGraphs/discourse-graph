import React, { useCallback, useState } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { TLImageShape, TLShape, useEditor, useValue } from "tldraw";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import posthog from "posthog-js";
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";
import {
  replaceShapeWithDiscourseNode,
  uploadImageShapeToRoam,
} from "~/components/canvas/convertShapeToDiscourseNode";

const BUTTON_INSET = 8;

const isConvertibleImage = (shape?: TLShape | null): shape is TLImageShape =>
  shape?.type === "image" && !shape.isLocked;

export const ImageConvertOverlay = (): JSX.Element | null => {
  const editor = useEditor();
  const extensionAPI = useExtensionAPI();
  const [uploading, setUploading] = useState(false);

  const imageShape = useValue<TLImageShape | null>(
    "imageConvertTarget",
    () => {
      if (!editor.isIn("select.idle")) return null;
      const hovered = editor.getHoveredShape();
      if (isConvertibleImage(hovered)) return hovered;
      const selected = editor.getOnlySelectedShape();
      return isConvertibleImage(selected) ? selected : null;
    },
    [editor],
  );

  const buttonPosition = useValue<{ left: number; top: number } | null>(
    "imageConvertButtonPosition",
    () => {
      if (!imageShape) return null;
      const bounds = editor.getShapePageBounds(imageShape.id);
      if (!bounds) return null;
      const vp = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
      return { left: vp.x + BUTTON_INSET, top: vp.y + BUTTON_INSET };
    },
    [editor, imageShape?.id],
  );

  const openConvertDialog = useCallback(async () => {
    if (!imageShape || !extensionAPI || uploading) return;
    posthog.capture("Canvas: Image Convert Button Clicked");
    setUploading(true);
    try {
      const src = await uploadImageShapeToRoam({ editor, shape: imageShape });
      if (!src) {
        dispatchToastEvent({
          id: "tldraw-image-convert-no-asset",
          title: "Could not read this image",
          severity: "warning",
        });
        return;
      }
      renderModifyNodeDialog({
        mode: "create",
        initialValue: { text: "", uid: "" },
        extensionAPI,
        imageUrl: src,
        onSuccess: async ({ text, uid, nodeType }) => {
          const shape = editor.getShape(imageShape.id);
          if (!shape || !nodeType) {
            dispatchToastEvent({
              id: "tldraw-image-convert-not-replaced",
              title: "Node created, but the image could not be replaced",
              severity: "warning",
            });
            return;
          }
          await replaceShapeWithDiscourseNode({
            editor,
            extensionAPI,
            shape,
            nodeType,
            text,
            uid,
          });
        },
        onClose: () => {},
      });
    } catch (error) {
      dispatchToastEvent({
        id: "tldraw-image-convert-failed",
        title: `Could not upload this image: ${String(error)}`,
        severity: "error",
      });
    } finally {
      setUploading(false);
    }
  }, [editor, extensionAPI, imageShape, uploading]);

  if (!buttonPosition) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Button
        small
        className="absolute z-20 rounded border border-gray-300 bg-white shadow"
        style={{
          left: `${buttonPosition.left}px`,
          top: `${buttonPosition.top}px`,
          pointerEvents: "all",
        }}
        icon={<Icon icon="new-object" />}
        loading={uploading}
        title="Convert to discourse node"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void openConvertDialog();
        }}
      />
    </div>
  );
};
