// Frame resolution and zoom helpers shared by the frame-anchored embeds and
// the full-page canvas (zoom-on-arrival). Lives in its own tldraw-only module
// so Tldraw.tsx can import it without a cycle through CanvasFrameEmbed.tsx.
import type { Editor, TLFrameShape, TLShapeId } from "tldraw";

export type FrameRef = { name?: string; shapeId?: string };

export const FRAME_ZOOM_INSET = 16;

// Resolve a frame by shape id first (stable across renames and moves), then fall
// back to a case-insensitive, trimmed name match. Duplicate names resolve to the
// first match with a warning. Returns null if neither path finds a frame.
export const resolveFrameShape = (
  editor: Editor,
  frame: FrameRef,
): TLFrameShape | null => {
  if (frame.shapeId) {
    const byId = editor.getShape<TLFrameShape>(frame.shapeId as TLShapeId);
    if (byId?.type === "frame") return byId;
  }

  if (frame.name) {
    const target = frame.name.trim().toLowerCase();
    const matches = editor
      .getCurrentPageShapes()
      .filter(
        (shape): shape is TLFrameShape =>
          shape.type === "frame" &&
          ((shape as TLFrameShape).props.name ?? "").trim().toLowerCase() ===
            target,
      );
    if (matches.length > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `dg-canvas: multiple frames named "${frame.name}"; using the first match.`,
      );
    }
    if (matches[0]) return matches[0];
  }

  return null;
};

// Frame always wins: zoom to the frame's current bounds so the embed tracks the
// frame even when it has been moved or resized on the canvas since last mount.
export const zoomToFrame = (editor: Editor, frame: FrameRef): boolean => {
  const shape = resolveFrameShape(editor, frame);
  if (!shape) return false;
  const bounds = editor.getShapePageBounds(shape);
  if (!bounds) return false;
  editor.zoomToBounds(bounds, { inset: FRAME_ZOOM_INSET });
  return true;
};
