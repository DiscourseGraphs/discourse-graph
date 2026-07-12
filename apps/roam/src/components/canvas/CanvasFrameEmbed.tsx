import React, { useCallback, useRef, useState } from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import type { Editor, TLFrameShape, TLShapeId } from "tldraw";
import { TldrawCanvas, type CanvasEmbedOptions } from "./Tldraw";
import { parseDgFrameEmbed } from "~/utils/dgFrameEmbed";

const FRAME_ZOOM_INSET = 16;

type FrameRef = { name?: string; shapeId?: string };

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
        `dg-frame: multiple frames named "${frame.name}"; using the first match.`,
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

const CanvasEmbedPlaceholder = ({ message }: { message: string }) => (
  <div
    className="flex items-center justify-center rounded-md border border-dashed border-gray-300 text-sm"
    style={{ height: "100px" }}
  >
    {message}
  </div>
);

const CanvasFrameEmbed = ({
  title,
  blockUid,
  frame,
}: {
  title: string;
  blockUid: string;
  frame: FrameRef | null;
}) => {
  const editorRef = useRef<Editor | null>(null);
  const [frameMissing, setFrameMissing] = useState(false);

  const handleEditorMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (!frame) return;
      // Defer one frame so tldraw has measured the embed's viewport before we
      // compute a viewport-relative zoom on first mount.
      requestAnimationFrame(() => {
        setFrameMissing(!zoomToFrame(editor, frame));
      });
    },
    [frame],
  );

  const handleRecenter = useCallback(() => {
    if (editorRef.current && frame) zoomToFrame(editorRef.current, frame);
  }, [frame]);

  // Frame-anchored: manage the camera ourselves (no session persistence).
  // Frameless: remember this embed's viewport independently, keyed by block uid.
  // Both start in focus mode (chrome hidden; cmd+. brings the controls back).
  const embedOptions: CanvasEmbedOptions = frame
    ? {
        disableSessionPersistence: true,
        onEditorMount: handleEditorMount,
        defaultFocusMode: true,
      }
    : { instanceKey: blockUid, defaultFocusMode: true };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <TldrawCanvas title={title} embedOptions={embedOptions} />
      {frame && (
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
      )}
      {frame && frameMissing && (
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

export const renderCanvasFrameEmbed = (
  button: HTMLElement,
  onloadArgs: OnloadArgs,
) => {
  button.hidden = true;

  if (!button.parentElement) return;

  const blockUid = getBlockUidFromTarget(button);
  if (!blockUid) return;

  const blockText = getTextByBlockUid(blockUid);
  const parsed = blockText ? parseDgFrameEmbed(blockText) : null;
  if (!parsed) return;

  const { title, frameName, frameShapeId } = parsed;

  const pageUid = getPageUidByPageTitle(title);
  if (!pageUid) {
    const wrapper = document.createElement("div");
    button.parentElement.appendChild(wrapper);
    renderWithUnmount(
      <CanvasEmbedPlaceholder message={`Canvas not found: ${title}`} />,
      wrapper,
    );
    return;
  }

  const frame: FrameRef | null =
    frameName || frameShapeId
      ? { name: frameName, shapeId: frameShapeId }
      : null;

  const wrapper = document.createElement("div");
  wrapper.className = "dg-frame-embed my-2 w-full overflow-hidden rounded-md";
  wrapper.style.height = "400px";
  wrapper.onmousedown = (e: MouseEvent) => e.stopPropagation();
  button.parentElement.appendChild(wrapper);

  renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      <CanvasFrameEmbed title={title} blockUid={blockUid} frame={frame} />
    </ExtensionApiContextProvider>,
    wrapper,
  );
};
