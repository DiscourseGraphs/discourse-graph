import React from "react";
import {
  Editor,
  HyperlinkButton,
  T,
  TLShape,
  TLShapeId,
  useEditor,
  useValue,
} from "tldraw";

type TextLink = { id: TLShapeId; url: string; left: number; top: number };

// Matches the hit area of tldraw's .tl-hyperlink-button.
const BUTTON_SIZE = 44;

// Furthest any handle sits outside the selection box: tldraw's rotate target on
// a coarse pointer is 31.5px; DragHandleOverlay's relation handles reach 20px.
const HANDLE_REACH = 32;

// meta is unvalidated, so this is the only guard before an href. Returning the
// parsed form keeps the href identical to what passed validation.
export const getTextShapeLinkUrl = (shape: TLShape): string | undefined => {
  if (shape.type !== "text") return undefined;
  const { url } = shape.meta;
  if (typeof url !== "string" || !T.linkUrl.isValid(url)) return undefined;
  try {
    // linkUrl resolves relative paths against a dummy origin; only absolute URLs render.
    return new URL(url).href;
  } catch {
    return undefined;
  }
};

type ViewportBox = { left: number; top: number; right: number; bottom: number };

const getHandleZone = (editor: Editor): ViewportBox | null => {
  const selection = editor.getSelectionPageBounds();
  if (!selection) return null;
  const topLeft = editor.pageToViewport({
    x: selection.minX,
    y: selection.minY,
  });
  const bottomRight = editor.pageToViewport({
    x: selection.maxX,
    y: selection.maxY,
  });
  return {
    left: topLeft.x - HANDLE_REACH,
    top: topLeft.y - HANDLE_REACH,
    right: bottomRight.x + HANDLE_REACH,
    bottom: bottomRight.y + HANDLE_REACH,
  };
};

const overlapsHandleZone = (
  { left, top }: { left: number; top: number },
  zone: ViewportBox,
): boolean =>
  left < zone.right &&
  left + BUTTON_SIZE > zone.left &&
  top < zone.bottom &&
  top + BUTTON_SIZE > zone.top;

// Text bounds hug the glyphs, so the icon sits just outside the right edge
// rather than in the shape corner where geo shapes draw it.
export const TextLinkOverlay = (): JSX.Element => {
  const editor = useEditor();
  const links = useValue<TextLink[]>(
    "textShapeLinks",
    () => {
      const viewport = editor.getViewportPageBounds();
      // The overlay renders above every shape and handle, so an icon near the
      // selection would swallow resize, rotate, and relation drags.
      const handleZone = getHandleZone(editor);
      return editor.getCurrentPageShapes().flatMap((shape) => {
        const url = getTextShapeLinkUrl(shape);
        if (!url) return [];
        const bounds = editor.getShapePageBounds(shape.id);
        if (!bounds || !viewport.collides(bounds)) return [];
        const anchor = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.midY,
        });
        const link = {
          id: shape.id,
          url,
          left: anchor.x,
          top: anchor.y - BUTTON_SIZE / 2,
        };
        return handleZone && overlapsHandleZone(link, handleZone) ? [] : [link];
      });
    },
    [editor],
  );
  const zoomLevel = useValue("zoomLevel", () => editor.getZoomLevel(), [
    editor,
  ]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {links.map(({ id, url, left, top }) => (
        <div
          key={id}
          style={{
            position: "absolute",
            left: `${left}px`,
            top: `${top}px`,
            width: `${BUTTON_SIZE}px`,
            height: `${BUTTON_SIZE}px`,
          }}
        >
          <HyperlinkButton url={url} zoomLevel={zoomLevel} />
        </div>
      ))}
    </div>
  );
};
