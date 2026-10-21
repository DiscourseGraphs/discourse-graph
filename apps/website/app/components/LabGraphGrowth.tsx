"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import Image from "next/image";
import type { GraphColors } from "~/utils/graphBackground/colors";
import {
  GROWTH_DURATION,
  drawGrowthFrame,
  prepareGrowth,
  type GrowthData,
  type GrowthModel,
} from "~/utils/labGraphGrowth";

// Share of the figure that must be on screen before the animation first plays.
const START_THRESHOLD = 0.6;
// Longest step one frame may advance. Frames stop in a background tab, so
// without a cap the time away would count as playback.
const MAX_FRAME_MS = 50;
const POSTER_SIZES = "(min-width: 1024px) 58vw, 100vw";

type LabGraphGrowthProps = {
  dataUrl: string;
  // The finished graph, shown when the data can't load or JavaScript is off.
  posterSrc: string;
  label: string;
  colors: GraphColors;
};

// Plays once when most of the figure is on screen, pauses while it is fully
// off screen, then holds the last frame with a replay button. The data is
// fetched on first approach, so it costs nothing for visitors who never
// scroll this far. With reduced motion it draws the finished graph.
export const LabGraphGrowth = ({
  dataUrl,
  posterSrc,
  label,
  colors,
}: LabGraphGrowthProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<(() => void) | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const { pulse, edge } = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fontFamily = getComputedStyle(canvas).fontFamily;
    const graphColors: GraphColors = { pulse, edge };
    let model: GrowthModel | null = null;
    let isLoading = false;
    let isDisposed = false;
    let isOnScreen = false;
    let hasStarted = false;
    let elapsed = reducedMotion ? GROWTH_DURATION : 0;
    let lastTime: number | null = null;
    let frameId = 0;

    const draw = (): void => {
      if (!model || canvas.clientWidth === 0) return;
      const ratio = canvas.width / canvas.clientWidth;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawGrowthFrame(context, {
        model,
        colors: graphColors,
        elapsed,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        fontFamily,
      });
    };

    const resize = (): void => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      draw();
    };

    const step = (time: number): void => {
      elapsed += Math.min(MAX_FRAME_MS, time - (lastTime ?? time));
      lastTime = time;
      draw();
      if (elapsed >= GROWTH_DURATION) {
        frameId = 0;
        setIsDone(true);
        return;
      }
      frameId = isOnScreen ? requestAnimationFrame(step) : 0;
    };

    const resume = (): void => {
      if (frameId || !model || elapsed >= GROWTH_DURATION) return;
      lastTime = null;
      frameId = requestAnimationFrame(step);
    };

    const replay = (): void => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      elapsed = 0;
      hasStarted = true;
      setIsDone(false);
      resume();
    };
    replayRef.current = replay;

    const startWhenMostlyVisible = (ratio: number): void => {
      if (!model || reducedMotion) return;
      if (hasStarted) {
        if (isOnScreen) resume();
      } else if (ratio >= START_THRESHOLD) {
        replay();
      }
    };

    const load = async (ratio: number): Promise<void> => {
      if (isLoading || model) return;
      isLoading = true;
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as GrowthData;
        if (isDisposed) return;
        model = prepareGrowth(data);
        setHasFailed(false);
        resize();
        startWhenMostlyVisible(ratio);
      } catch (error) {
        console.error(`Error loading lab graph data from ${dataUrl}:`, error);
        // Retry the next time the figure scrolls into view.
        isLoading = false;
        if (!isDisposed) setHasFailed(true);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        isOnScreen = entry.isIntersecting;
        if (!isOnScreen) return;
        if (model) startWhenMostlyVisible(entry.intersectionRatio);
        else void load(entry.intersectionRatio);
      },
      { threshold: [0, START_THRESHOLD] },
    );
    intersectionObserver.observe(canvas);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      replayRef.current = null;
    };
  }, [dataUrl, pulse, edge]);

  const handleReplay = (): void => {
    // The button unmounts while the animation plays, so keep focus on the
    // figure instead of letting it drop to the page.
    canvasRef.current?.focus();
    replayRef.current?.();
  };

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-dark/10 bg-white shadow-sm">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-0 h-full w-full focus:outline-none"
      />
      {hasFailed && (
        <Image
          src={posterSrc}
          alt={label}
          fill
          className="object-cover"
          sizes={POSTER_SIZES}
        />
      )}
      <noscript>
        <Image
          src={posterSrc}
          alt={label}
          fill
          className="object-cover"
          sizes={POSTER_SIZES}
        />
      </noscript>
      {isDone && (
        <button
          type="button"
          onClick={handleReplay}
          className="absolute right-3 top-3 rounded-full border border-neutral-dark/15 bg-white/90 px-3 py-1 text-xs font-medium text-neutral-dark/70 hover:text-neutral-dark"
        >
          Replay
        </button>
      )}
    </div>
  );
};
