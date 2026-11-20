import React from "react";
import {
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

// Text bounds hug the glyphs, so the icon sits just outside the right edge
// rather than in the shape corner where geo shapes draw it.
export const TextLinkOverlay = (): JSX.Element => {
  const editor = useEditor();
  const links = useValue<TextLink[]>(
    "textShapeLinks",
    () => {
      const viewport = editor.getViewportPageBounds();
      return editor.getCurrentPageShapes().flatMap((shape) => {
        const url = getTextShapeLinkUrl(shape);
        if (!url) return [];
        const bounds = editor.getShapePageBounds(shape.id);
        if (!bounds || !viewport.collides(bounds)) return [];
        const anchor = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.midY,
        });
        return [
          {
            id: shape.id,
            url,
            left: anchor.x,
            top: anchor.y - BUTTON_SIZE / 2,
          },
        ];
      });
    },
    [editor],
  );
  const zoomLevel = useValue("zoomLevel", () => editor.getZoomLevel(), [
    editor,
  ]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {links.map(({ id, url, left, top }) => (
        <div
          key={id}
          className="absolute"
          style={{
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
