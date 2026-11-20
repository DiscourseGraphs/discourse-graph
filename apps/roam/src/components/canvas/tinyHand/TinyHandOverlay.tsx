/*!
 * Hand artwork, arm motion and tap sound adapted from TinyHand.
 * https://github.com/nilbuild/tinyhand/tree/da98f98d529971297487b0ec6ef07dc549555686
 * Copyright (c) 2026 Kamran Ahmed
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TldrawUiButton, useEditor, useValue } from "tldraw";
import {
  extendTinyHandStroke,
  startTinyHandStroke,
  TinyHandStroke,
} from "./tinyHandStroke";
import { TinyHandPointer } from "./TinyHandPointer";
import tapSoundBase64 from "./tap.wav";

const LAVENDER_INK = "#8754f2";
const TAP_SOUND_URL = `data:audio/wav;base64,${tapSoundBase64}`;

type Mark = { path: string; arrow: boolean };
type PointerEvent = React.PointerEvent<HTMLDivElement>;

const stopControlInput = (event: React.SyntheticEvent): void =>
  event.stopPropagation();

const ActiveTinyHand = ({
  canvas,
  soundEnabled,
  setSoundEnabled,
}: {
  canvas: HTMLElement;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}): JSX.Element => {
  const editor = useEditor();
  const arrowId = useId();
  const { x, y, z } = useValue("TinyHand camera", () => editor.getCamera(), [
    editor,
  ]);
  const isPanning = useValue(
    "TinyHand native pan cursor",
    () => {
      const { type } = editor.getInstanceState().cursor;
      return (
        editor.inputs.isPanning && (type === "grab" || type === "grabbing")
      );
    },
    [editor],
  );
  const gesture = useRef<{
    id: number;
    stroke: TinyHandStroke;
    touchSoundPending: boolean;
  } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [pressed, setPressed] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [preview, setPreview] = useState<Mark | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    const container = editor.getContainer();
    const preventSpaceScroll = (event: KeyboardEvent): void => {
      if (
        event.target === container &&
        event.code === "Space" &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
      }
    };
    container.addEventListener("keydown", preventSpaceScroll);
    return () => container.removeEventListener("keydown", preventSpaceScroll);
  }, [editor]);

  const pointFromEvent = (event: PointerEvent) =>
    editor.screenToPage({ x: event.clientX, y: event.clientY });

  const movePointer = (event: PointerEvent): void => {
    const { left, top } = event.currentTarget.getBoundingClientRect();
    setPointer({ x: event.clientX - left, y: event.clientY - top });
  };

  const cancelGesture = (): void => {
    gesture.current = null;
    setPreview(null);
    setPressed(false);
    setPointer(null);
  };

  const playTap = (): void => {
    if (!soundEnabled) return;
    audio.current ??= new Audio(TAP_SOUND_URL);
    audio.current.currentTime = 0;
    void audio.current.play().catch(() => undefined);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (
      event.isPrimary &&
      !gesture.current &&
      (event.button === 1 || (event.button === 0 && editor.inputs.isPanning))
    ) {
      setPointer(null);
      return;
    }

    event.stopPropagation();
    if (!event.isPrimary) {
      cancelGesture();
      return;
    }
    if (event.button !== 0 || gesture.current) return;

    editor.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    // A second touch can turn this press into a silent canvas pinch.
    const touchSoundPending = event.pointerType === "touch";
    gesture.current = {
      touchSoundPending,
      id: event.pointerId,
      stroke: startTinyHandStroke(pointFromEvent(event)),
    };
    movePointer(event);
    setPressed(true);
    if (!touchSoundPending) playTap();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!gesture.current && editor.inputs.isPanning) return;
    event.stopPropagation();
    if (!event.isPrimary || (event.pointerType === "touch" && !gesture.current))
      return;

    movePointer(event);
    if (gesture.current?.id !== event.pointerId) return;

    gesture.current.stroke = extendTinyHandStroke(
      gesture.current.stroke,
      pointFromEvent(event),
      z,
    );
    const { path } = gesture.current.stroke;
    if (!path) return;
    if (gesture.current.touchSoundPending) {
      gesture.current.touchSoundPending = false;
      playTap();
    }
    setPreview({ path, arrow: event.metaKey || event.ctrlKey });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!gesture.current && (event.button === 1 || editor.inputs.isPanning))
      return;
    event.stopPropagation();
    if (gesture.current?.id !== event.pointerId) return;

    if (gesture.current.touchSoundPending) playTap();
    const { path } = extendTinyHandStroke(
      gesture.current.stroke,
      pointFromEvent(event),
      z,
    );
    setPressed(false);
    gesture.current = null;
    setPreview(null);

    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.pointerType === "touch" ||
      event.clientX < bounds.left ||
      event.clientX >= bounds.right ||
      event.clientY < bounds.top ||
      event.clientY >= bounds.bottom
    ) {
      setPointer(null);
    }

    if (path) {
      setMarks((previous) => [
        ...previous,
        { path, arrow: event.metaKey || event.ctrlKey },
      ]);
    }
  };

  const onPointerInterrupted = (event: PointerEvent): void => {
    if (gesture.current?.id === event.pointerId) cancelGesture();
  };

  const clearMarks = (): void => {
    gesture.current = null;
    setPreview(null);
    setMarks([]);
    setPressed(false);
  };

  const drawMark = ({ path, arrow }: Mark, index: number): JSX.Element => (
    <path
      key={index}
      d={path}
      markerEnd={arrow ? `url(#${arrowId})` : undefined}
      data-tiny-hand-mark=""
    />
  );

  return (
    <>
      {createPortal(
        <div
          className="dg-tiny-hand-surface"
          data-testid="tiny-hand-surface"
          data-panning={isPanning ? "" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerInterrupted}
          onLostPointerCapture={onPointerInterrupted}
          onPointerLeave={() => setPointer(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <svg aria-hidden="true" width="100%" height="100%">
            <defs>
              <marker
                id={arrowId}
                markerWidth="4"
                markerHeight="4"
                refX="4"
                refY="2"
                orient="auto"
              >
                <path d="M 0 0 L 4 2 L 0 4 Z" fill={LAVENDER_INK} />
              </marker>
            </defs>
            <g
              transform={`scale(${z}) translate(${x} ${y})`}
              fill="none"
              stroke={LAVENDER_INK}
              strokeWidth={4 / z}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {marks.map(drawMark)}
              {preview && drawMark(preview, marks.length)}
            </g>
            {pointer && !isPanning && (
              <TinyHandPointer {...pointer} pressed={pressed} />
            )}
          </svg>
        </div>,
        canvas,
      )}
      {createPortal(
        <div
          className="dg-tiny-hand-controls"
          role="group"
          aria-label="TinyHand"
          onPointerDown={stopControlInput}
          onPointerUp={stopControlInput}
          onTouchStart={stopControlInput}
          onTouchEnd={stopControlInput}
        >
          <TldrawUiButton type="normal" onClick={clearMarks}>
            Clear marks
          </TldrawUiButton>
          <TldrawUiButton
            type="normal"
            aria-pressed={soundEnabled}
            onClick={() => {
              if (soundEnabled) audio.current?.pause();
              setSoundEnabled(!soundEnabled);
            }}
          >
            Tap sound
          </TldrawUiButton>
          <TldrawUiButton
            type="normal"
            title="Exit TinyHand (Esc)"
            onClick={() => editor.setCurrentTool("select").focus()}
          >
            Exit TinyHand
          </TldrawUiButton>
        </div>,
        editor.getContainer(),
      )}
    </>
  );
};

export const TinyHandOverlay = ({
  toolId,
}: {
  toolId: string;
}): JSX.Element | null => {
  const editor = useEditor();
  const active = useValue("TinyHand active", () => editor.isIn(toolId), [
    editor,
    toolId,
  ]);
  const pageId = useValue("TinyHand page", () => editor.getCurrentPageId(), [
    editor,
  ]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  if (!active) return null;

  // tldraw listens for wheel and pinch gestures on the canvas element.
  const canvas = editor.getContainer().querySelector<HTMLElement>(".tl-canvas");
  if (!canvas) return null;

  return (
    <ActiveTinyHand
      key={pageId}
      canvas={canvas}
      soundEnabled={soundEnabled}
      setSoundEnabled={setSoundEnabled}
    />
  );
};
