import React from "react";
import { HyperlinkButton, TLShapeId, useEditor, useValue } from "tldraw";
import { getTextShapeLinkUrl } from "~/utils/textShapeLink";

type TextLink = { id: TLShapeId; url: string; left: number; top: number };

// Matches the hit area of tldraw's .tl-hyperlink-button.
const BUTTON_SIZE = 44;

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
