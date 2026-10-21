"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  GROWTH_DURATION,
  drawGrowthFrame,
  prepareGrowth,
  type GrowthData,
  type GrowthModel,
} from "~/utils/labGraphGrowth";

// Share of the figure that must be on screen before the animation plays.
const PLAY_THRESHOLD = 0.4;

type LabGraphGrowthProps = {
  dataUrl: string;
  label: string;
};

// Plays once when scrolled into view, pauses while off screen, then holds the
// last frame with a replay button. The data is fetched on first approach, so
// it costs nothing for visitors who never scroll this far. With reduced
// motion it draws the finished graph straight away.
export const LabGraphGrowth = ({
  dataUrl,
  label,
}: LabGraphGrowthProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<(() => void) | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fontFamily = getComputedStyle(canvas).fontFamily;
    let model: GrowthModel | null = null;
    let isLoading = false;
    let isDisposed = false;
    let isVisible = false;
    let hasStarted = false;
    let elapsed = reducedMotion ? GROWTH_DURATION : 0;
    let startedAt: number | null = null;
    let frameId = 0;

    const draw = (): void => {
      if (!model || canvas.clientWidth === 0) return;
      const ratio = canvas.width / canvas.clientWidth;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawGrowthFrame(context, {
        model,
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
      if (startedAt === null) startedAt = time - elapsed;
      elapsed = time - startedAt;
      draw();
      if (elapsed >= GROWTH_DURATION) {
        frameId = 0;
        setIsDone(true);
        return;
      }
      frameId = isVisible ? requestAnimationFrame(step) : 0;
    };

    const resume = (): void => {
      if (frameId || !model || elapsed >= GROWTH_DURATION) return;
      startedAt = null;
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

    const play = (): void => {
      if (!model || reducedMotion || !isVisible) return;
      if (hasStarted) resume();
      else replay();
    };

    const load = async (): Promise<void> => {
      if (isLoading) return;
      isLoading = true;
      try {
        const response = await fetch(dataUrl);
        const data = (await response.json()) as GrowthData;
        if (isDisposed) return;
        model = prepareGrowth(data);
        resize();
        play();
      } catch (error) {
        // The figure stays blank; there is nothing useful to show instead.
        console.error(`Error loading lab graph data from ${dataUrl}:`, error);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) void load();
        isVisible = entry.intersectionRatio >= PLAY_THRESHOLD;
        if (isVisible) play();
      },
      { threshold: [0, PLAY_THRESHOLD] },
    );
    intersectionObserver.observe(canvas);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      replayRef.current = null;
    };
  }, [dataUrl]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-dark/10 bg-white shadow-sm">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      />
      <button
        type="button"
        onClick={() => replayRef.current?.()}
        tabIndex={isDone ? 0 : -1}
        aria-hidden={!isDone}
        className={`absolute right-3 top-3 rounded-full border border-neutral-dark/15 bg-white/90 px-3 py-1 text-xs font-medium text-neutral-dark/70 transition-opacity hover:text-neutral-dark ${
          isDone ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Replay
      </button>
    </div>
  );
};
