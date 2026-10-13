"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { GraphColors } from "~/utils/graphBackground/colors";
import { drawGraph } from "~/utils/graphBackground/draw";
import {
  createGraphState,
  resizeGraph,
  setAvoidRects,
  settleGraph,
  updateGraph,
  type Pointer,
  type Rect,
} from "~/utils/graphBackground/simulation";

type GraphBackgroundAnimationProps = {
  colors: GraphColors;
};

// Renders an absolutely positioned canvas that fills its parent, so the parent
// must be positioned (e.g. `relative`) and should clip overflow. The first
// descendant of the parent marked `data-graph-avoid` fades nearby nodes to keep
// text legible, and pointer tracking listens on the parent.
export const GraphBackgroundAnimation = ({
  colors,
}: GraphBackgroundAnimationProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Depend on the strings, not the `colors` object: a new object identity
  // (e.g. after router.refresh()) would otherwise rebuild a fresh random graph.
  const { pulse, edge } = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    const state = createGraphState();
    const graphColors: GraphColors = { pulse, edge };
    const cursor = { clientX: 0, clientY: 0, isOver: false };
    let frameId = 0;
    let lastTime = 0;
    let isInView = true;

    const render = (time: number): void => {
      drawGraph(context, { state, colors: graphColors, time });
    };

    const getAvoidElement = (): Element | null =>
      canvas.parentElement?.querySelector("[data-graph-avoid]") ?? null;

    const measureAvoidRects = (): Rect[] => {
      const element = getAvoidElement();
      if (!element) return [];
      const canvasRect = canvas.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return [
        {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top,
        },
      ];
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      setAvoidRects(state, measureAvoidRects());
      if (!resizeGraph(state, { width: rect.width, height: rect.height })) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      render(performance.now());
    };

    // Recomputed from client coordinates each frame so the cursor stays put
    // when the page scrolls. Scrolling can also move the section away without
    // firing pointerleave, so a position outside the canvas counts as left.
    const getPointer = (): Pointer | null => {
      if (!cursor.isOver) return null;
      const rect = canvas.getBoundingClientRect();
      const x = cursor.clientX - rect.left;
      const y = cursor.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        cursor.isOver = false;
        return null;
      }
      return { x, y };
    };

    const shouldRun = (): boolean => isInView && !reducedMotion;

    const step = (time: number): void => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      updateGraph(state, { delta, pointer: getPointer() });
      render(time);
      frameId = shouldRun() ? requestAnimationFrame(step) : 0;
    };

    // Runs the loop only while the section is on screen and motion is allowed.
    const syncLoop = (): void => {
      if (shouldRun()) {
        if (frameId) return;
        lastTime = performance.now();
        frameId = requestAnimationFrame(step);
      } else {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const handleMotionChange = (): void => {
      reducedMotion = motionQuery.matches;
      if (reducedMotion) {
        cursor.isOver = false;
        settleGraph(state);
        render(performance.now());
      }
      syncLoop();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const contentObserver = new ResizeObserver(() => {
      setAvoidRects(state, measureAvoidRects());
      render(performance.now());
    });
    const avoidElement = getAvoidElement();
    if (avoidElement) contentObserver.observe(avoidElement);
    motionQuery.addEventListener("change", handleMotionChange);
    // The canvas ignores pointer events so the page content stays clickable;
    // listen on the parent section instead.
    const section = canvas.parentElement;
    const handlePointerMove = (event: PointerEvent): void => {
      if (reducedMotion || event.pointerType === "touch") return;
      cursor.clientX = event.clientX;
      cursor.clientY = event.clientY;
      cursor.isOver = true;
    };
    const handlePointerLeave = (): void => {
      cursor.isOver = false;
    };
    section?.addEventListener("pointermove", handlePointerMove);
    section?.addEventListener("pointerleave", handlePointerLeave);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isInView = entry?.isIntersecting ?? true;
      syncLoop();
    });
    intersectionObserver.observe(canvas);
    syncLoop();

    return () => {
      isInView = false;
      cancelAnimationFrame(frameId);
      frameId = 0;
      resizeObserver.disconnect();
      contentObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      section?.removeEventListener("pointermove", handlePointerMove);
      section?.removeEventListener("pointerleave", handlePointerLeave);
      intersectionObserver.disconnect();
    };
  }, [pulse, edge]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
