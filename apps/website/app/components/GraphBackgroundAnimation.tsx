"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { GraphColors } from "~/utils/graphBackground/colors";
import { drawGraph } from "~/utils/graphBackground/draw";
import {
  createGraphState,
  createTopology,
  resizeGraph,
  setAvoidRects,
  settleGraph,
  updateGraph,
  type Pointer,
  type LabGraphData,
  type Rect,
} from "~/utils/graphBackground/simulation";

type GraphBackgroundAnimationProps = {
  colors: GraphColors;
  followPointer?: boolean;
  // Links only form between nodes linked in this real graph. Keep it referentially stable: a new object rebuilds the graph.
  topology?: LabGraphData;
};

// Renders an absolutely positioned canvas that fills its parent, so the parent
// must be positioned (e.g. `relative`) and should clip overflow. Descendants of
// the parent marked `data-graph-avoid` fade nearby nodes to keep text legible,
// and pointer tracking listens on the parent.
export const GraphBackgroundAnimation = ({
  colors,
  followPointer = true,
  topology,
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
    const state = createGraphState(
      topology && createTopology({ data: topology }),
    );
    const graphColors: GraphColors = { pulse, edge };
    const cursor = { clientX: 0, clientY: 0, isOver: false };
    let frameId = 0;
    let lastTime = 0;
    let isInView = true;
    let appliedRatio = 0;

    const render = (time: number): void => {
      drawGraph(context, { state, colors: graphColors, time });
    };

    const getAvoidElements = (): Element[] =>
      Array.from(
        canvas.parentElement?.querySelectorAll("[data-graph-avoid]") ?? [],
      );

    const measureAvoidRects = (): Rect[] => {
      const canvasRect = canvas.getBoundingClientRect();
      return getAvoidElements().map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top,
        };
      });
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ratio = window.devicePixelRatio || 1;
      setAvoidRects(state, measureAvoidRects());
      const sizeChanged = resizeGraph(state, {
        width: rect.width,
        height: rect.height,
      });
      // The bitmap also has to change when only the pixel ratio did.
      if (!sizeChanged && ratio === appliedRatio) return;
      appliedRatio = ratio;
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

    // Moving the window to another display changes the pixel ratio without
    // resizing the canvas. The query matches the current ratio, so it is
    // re-created after every change.
    let ratioQuery: MediaQueryList | null = null;
    const handleRatioChange = (): void => {
      resize();
      watchPixelRatio();
    };
    const watchPixelRatio = (): void => {
      ratioQuery?.removeEventListener("change", handleRatioChange);
      ratioQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      ratioQuery.addEventListener("change", handleRatioChange);
    };

    resize();
    watchPixelRatio();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const contentObserver = new ResizeObserver(() => {
      setAvoidRects(state, measureAvoidRects());
      render(performance.now());
    });
    for (const element of getAvoidElements()) contentObserver.observe(element);
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
    if (followPointer) {
      section?.addEventListener("pointermove", handlePointerMove);
      section?.addEventListener("pointerleave", handlePointerLeave);
    }
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
      ratioQuery?.removeEventListener("change", handleRatioChange);
      section?.removeEventListener("pointermove", handlePointerMove);
      section?.removeEventListener("pointerleave", handlePointerLeave);
      intersectionObserver.disconnect();
    };
  }, [pulse, edge, followPointer, topology]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
