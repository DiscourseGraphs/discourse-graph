import { HyperlinkButton, useEditor, useValue, TLShapeId } from "tldraw";
import { getTextShapeLinkUrl } from "~/components/canvas/utils/textShapeLink";

// Matches tldraw's own HyperlinkButton, which hides itself when zoomed out.
const HIDE_BELOW_ZOOM = 0.32;

type TextLink = { id: TLShapeId; url: string; left: number; top: number };

// Rendered here, not on a custom shape util, so the stock text shape stays
// untouched -- at the cost of rotation, frame clipping and stacking fidelity.
export const TextLinkOverlay = () => {
  const editor = useEditor();

  const links = useValue<TextLink[]>(
    "textShapeLinks",
    () => {
      if (editor.getZoomLevel() < HIDE_BELOW_ZOOM) return [];
      const viewport = editor.getViewportPageBounds();
      return editor.getCurrentPageShapes().flatMap<TextLink>((shape) => {
        if (shape.type !== "text" || editor.isShapeHidden(shape)) return [];
        const url = getTextShapeLinkUrl(shape);
        if (!url) return [];
        const bounds = editor.getShapePageBounds(shape.id);
        if (!bounds || !viewport.includes(bounds)) return [];
        const topRight = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.minY,
        });
        const bottomRight = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.maxY,
        });
        return [
          {
            id: shape.id,
            url,
            left: topRight.x,
            top: (topRight.y + bottomRight.y) / 2,
          },
        ];
      });
    },
    [editor],
  );

  return (
    <div className="dg-text-link-overlay">
      {links.map(({ id, url, left, top }) => (
        <div
          key={id}
          className="dg-text-link-anchor"
          style={{ left: `${left}px`, top: `${top}px` }}
        >
          <HyperlinkButton url={url} />
        </div>
      ))}
    </div>
  );
};
