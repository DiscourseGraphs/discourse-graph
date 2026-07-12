import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, TLFrameShape, TLShapeId } from "tldraw";
import { TldrawCanvas, type CanvasEmbedOptions } from "./Tldraw";
import { getCanvasFrameShapes } from "./useRoamStore";

const FRAME_ZOOM_INSET = 16;

export type FrameRef = { name?: string; shapeId?: string };

// Decide whether a parsed frame argument actually maps to a frame on the canvas
// by scanning the persisted frame shapes (no editor mounted). The classic embed
// renderer uses this to route: no match -> the frame argument is ignored and the
// whole canvas renders. Sync-mode canvases may have a slightly stale snapshot;
// the worst case is falling back to the whole-canvas embed.
export const findCanvasFrameRef = ({
  pageUid,
  frameName,
  frameShapeId,
}: {
  pageUid: string;
  frameName?: string;
  frameShapeId?: string;
}): FrameRef | null => {
  if (!frameName && !frameShapeId) return null;
  try {
    const frames = getCanvasFrameShapes(pageUid);
    const matchesId =
      !!frameShapeId && frames.some((frame) => frame.id === frameShapeId);
    const target = frameName?.trim().toLowerCase();
    const matchesName =
      !!target &&
      frames.some(
        (frame) => (frame.props.name ?? "").trim().toLowerCase() === target,
      );

    return matchesId || matchesName
      ? { name: frameName, shapeId: frameShapeId }
      : null;
  } catch {
    return null;
  }
};

// Resolve a frame by shape id first (stable across renames and moves), then fall
// back to a case-insensitive, trimmed name match. Duplicate names resolve to the
// first match with a warning. Returns null if neither path finds a frame.
const resolveFrameShape = (
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
const zoomToFrame = (editor: Editor, frame: FrameRef): boolean => {
  const shape = resolveFrameShape(editor, frame);
  if (!shape) return false;
  const bounds = editor.getShapePageBounds(shape);
  if (!bounds) return false;
  editor.zoomToBounds(bounds, { inset: FRAME_ZOOM_INSET });
  return true;
};

// Frame-anchored variant of the canvas embed: mounted by renderCanvasEmbed only
// when the block's frame argument maps to a real frame on the canvas.
export const CanvasFrameEmbed = ({
  title,
  frame,
}: {
  title: string;
  frame: FrameRef;
}) => {
  const editorRef = useRef<Editor | null>(null);
  const rafRef = useRef<number | null>(null);
  const [frameMissing, setFrameMissing] = useState(false);

  const handleEditorMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Defer one frame so tldraw has measured the embed's viewport before we
      // compute a viewport-relative zoom on first mount. Track the handle so the
      // cleanup effect can cancel it if the embed unmounts within the frame —
      // otherwise the callback runs against a disposed editor.
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setFrameMissing(!zoomToFrame(editor, frame));
      });
    },
    [frame],
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const handleRecenter = useCallback(() => {
    // Re-resolve on click so a frame deleted/renamed since mount clears (or
    // raises) the not-found notice instead of leaving stale state.
    if (editorRef.current)
      setFrameMissing(!zoomToFrame(editorRef.current, frame));
  }, [frame]);

  // Manage the camera ourselves (zoom-to-frame on every mount, no session
  // persistence) and start with the tldraw chrome hidden (cmd+. restores it).
  const embedOptions: CanvasEmbedOptions = {
    disableSessionPersistence: true,
    onEditorMount: handleEditorMount,
    defaultFocusMode: true,
  };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <TldrawCanvas title={title} embedOptions={embedOptions} />
      <button
        type="button"
        className="bp3-button bp3-minimal bp3-small"
        title="Re-center on frame"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleRecenter}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 300,
          background: "rgba(255,255,255,0.9)",
        }}
      >
        ⌖
      </button>
      {frameMissing && (
        <div
          className="rounded px-2 py-1 text-xs text-[#5c7080] shadow"
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            zIndex: 300,
            background: "rgba(255,255,255,0.9)",
          }}
        >
          Frame {frame.name ? `“${frame.name}” ` : ""}not found on [[
          {title}]]
        </div>
      )}
    </div>
  );
};
