/*!
 * Hand artwork and tap sound from TinyHand (https://github.com/nilbuild/tinyhand).
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
import { TldrawUiButton, useEditor, useValue } from "tldraw";
import {
  extendTinyHandStroke,
  startTinyHandStroke,
  TinyHandStroke,
} from "./tinyHandStroke";
import tapSoundBase64 from "./tap.wav";

const TAP_SOUND_URL = `data:audio/wav;base64,${tapSoundBase64}`;

type Mark = { path: string; arrow: boolean };
type PointerEvent = React.PointerEvent<HTMLDivElement>;

const TinyHandPointer = ({ x, y }: { x: number; y: number }): JSX.Element => (
  <g
    className="dg-tiny-hand-pointer"
    fill="#202124"
    transform={`translate(${x} ${y}) rotate(-24) translate(-10 -2)`}
  >
    <path
      d="M 19 25 V 86"
      stroke="#202124"
      strokeWidth="10"
      strokeLinecap="round"
    />
    <path
      d="M 19 25 V 86"
      stroke="#fff"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path d="M26.322 10.094a2.67 2.67 0 00-1.805.701 3.096 3.096 0 00-2.909-2.047c-.925 0-1.757.409-2.324 1.055a3.092 3.092 0 00-2.746-1.675 3.091 3.091 0 00-2.679 1.552c-.382-1.713-.875-3.95-1.19-5.382C12.434 2.983 11.261 2 9.887 2a2.815 2.815 0 00-2.329 1.216 2.813 2.813 0 00-.464 2.12c.077.357 1.275 5.914 2.083 9.643-.978-1.186-2.245-2.265-3.842-2.404a5.22 5.22 0 00-.458-.02c-1.337 0-2.377.57-2.78 1.524-.347.82-.14 1.764.54 2.464 1.597 1.645 2.279 3.041 2.938 4.391.453.928.922 1.888 1.659 2.87.835 1.114 1.963 1.902 2.869 2.535.47.328 1.055.737 1.184.944.342.546.494 1.512.521 1.807.045.515.478.91.995.91h3.673c1.708 0 2.459-.686 2.907-1.096.04-.037.089-.081.131-.117.04.033.086.073.124.107.471.414 1.26 1.106 3.143 1.106h2.633a1 1 0 001-1l-.002-.614c-.006-1.3-.014-2.919.342-3.42.675-.951 2.246-3.645 2.246-8.093v-4.101a2.68 2.68 0 00-2.678-2.678z" />
    <path
      fill="#fff"
      d="M14.448 11.218a2.09 2.09 0 014.18 0v1.418c0 .577.89.565.89.008v-.806a2.09 2.09 0 014.18 0v1.354c0 .544.945.523.945.015v-.434A1.678 1.678 0 0128 12.772v4.101c0 3.489-1.06 6.102-2.062 7.514-.607.855-.525 2.715-.525 4.612H22.78c-2.414 0-2.391-1.257-3.267-1.257S18.637 29 16.476 29h-3.673s-.123-1.378-.669-2.25c-.546-.872-2.793-1.804-4.1-3.547-1.719-2.292-1.856-4.448-4.68-7.357-.952-.981-.287-2.466 1.894-2.275 2.378.208 4.069 3.325 4.919 4.597.391.585.762.152.693-.158-.262-1.167-2.782-12.85-2.782-12.85a1.836 1.836 0 113.615-.647s1.547 7.036 1.734 7.779c.186.743 1.022.626 1.022-.03v-1.044z"
    />
    <path d="M15.5 17a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5zM19.5 17a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5zM23.5 18a.5.5 0 00-.5.5v5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5z" />
  </g>
);

const ActiveTinyHand = ({
  soundEnabled,
  setSoundEnabled,
}: {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}): JSX.Element => {
  const editor = useEditor();
  const arrowId = useId();
  const { x, y, z } = useValue("TinyHand camera", () => editor.getCamera(), [
    editor,
  ]);
  const gesture = useRef<{ id: number; stroke: TinyHandStroke } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const tapId = useRef(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [tap, setTap] = useState<{ x: number; y: number; id: number } | null>(
    null,
  );
  const [marks, setMarks] = useState<Mark[]>([]);
  const [preview, setPreview] = useState<Mark | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const pointFromEvent = (event: PointerEvent) =>
    editor.screenToPage({ x: event.clientX, y: event.clientY });

  const movePointer = (event: PointerEvent): void => {
    const { left, top } = event.currentTarget.getBoundingClientRect();
    setPointer({ x: event.clientX - left, y: event.clientY - top });
  };

  const onPointerDown = (event: PointerEvent): void => {
    event.stopPropagation();
    if (event.button !== 0 || !event.isPrimary || gesture.current) return;

    editor.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      id: event.pointerId,
      stroke: startTinyHandStroke(pointFromEvent(event)),
    };
    movePointer(event);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!event.isPrimary) return;

    movePointer(event);
    if (gesture.current?.id !== event.pointerId) return;

    gesture.current.stroke = extendTinyHandStroke(
      gesture.current.stroke,
      pointFromEvent(event),
      z,
    );
    const { path } = gesture.current.stroke;
    if (path) setPreview({ path, arrow: event.metaKey || event.ctrlKey });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (gesture.current?.id !== event.pointerId) return;

    const point = pointFromEvent(event);
    const { path } = extendTinyHandStroke(gesture.current.stroke, point, z);
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
      return;
    }

    setTap({ x: point.x, y: point.y, id: ++tapId.current });
    if (soundEnabled) {
      audio.current ??= new Audio(TAP_SOUND_URL);
      audio.current.currentTime = 0;
      void audio.current.play().catch(() => undefined);
    }
  };

  const cancelGesture = (event: PointerEvent): void => {
    if (gesture.current?.id !== event.pointerId) return;

    gesture.current = null;
    setPreview(null);
    setPointer(null);
  };

  const clearMarks = (): void => {
    gesture.current = null;
    setPreview(null);
    setMarks([]);
    setTap(null);
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
    <div className="dg-tiny-hand">
      <div
        className="dg-tiny-hand-surface"
        data-testid="tiny-hand-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
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
              <path d="M 0 0 L 4 2 L 0 4 Z" fill="var(--color-accent)" />
            </marker>
          </defs>
          <g
            transform={`scale(${z}) translate(${x} ${y})`}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={4 / z}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {marks.map(drawMark)}
            {preview && drawMark(preview, marks.length)}
            {tap && (
              <circle
                key={tap.id}
                className="dg-tiny-hand-tap"
                cx={tap.x}
                cy={tap.y}
                r={12 / z}
                onAnimationEnd={() => setTap(null)}
              />
            )}
          </g>
          {pointer && <TinyHandPointer {...pointer} />}
        </svg>
      </div>
      <div className="dg-tiny-hand-controls" role="group" aria-label="TinyHand">
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
      </div>
    </div>
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

  return active ? (
    <ActiveTinyHand
      key={pageId}
      soundEnabled={soundEnabled}
      setSoundEnabled={setSoundEnabled}
    />
  ) : null;
};
