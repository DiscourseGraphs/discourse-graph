import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Elevation, Icon } from "@blueprintjs/core";
import type { Editor } from "tldraw";
import { TldrawCanvas, type CanvasEmbedOptions } from "./Tldraw";
import { getCanvasFrameShapes } from "./useRoamStore";
import { zoomToFrame, type FrameRef } from "./canvasFrameRef";

export type { FrameRef } from "./canvasFrameRef";

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

// Frame-anchored variant of the canvas embed: mounted by renderCanvasEmbed only
// when the block's frame argument maps to a real frame on the canvas. The
// optional notice explains a forced live render (e.g. the sync-mode fallback
// from the snapshot renderer).
export const CanvasFrameEmbed = ({
  title,
  frame,
  notice,
}: {
  title: string;
  frame: FrameRef;
  notice?: string;
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
      <Button
        small
        title="Re-center on frame"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleRecenter}
        style={{ position: "absolute", top: 6, right: 6, zIndex: 300 }}
      >
        ⌖
      </Button>
      {notice && (
        <Card
          elevation={Elevation.ONE}
          title={notice}
          style={{
            position: "absolute",
            top: 8,
            right: 44,
            zIndex: 300,
            padding: "2px 6px",
            cursor: "help",
          }}
        >
          <Icon icon="info-sign" size={12} color="#5c7080" />
        </Card>
      )}
      {frameMissing && (
        <Card
          elevation={Elevation.ONE}
          className="text-xs text-[#5c7080]"
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            zIndex: 300,
            padding: "4px 8px",
          }}
        >
          Frame {frame.name ? `“${frame.name}” ` : ""}not found on [[
          {title}]]
        </Card>
      )}
    </div>
  );
};
