"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

type ScaledStageProps = {
  children: ReactNode;
  height: number;
  /** Text alternative for the illustration, read by screen readers. */
  label: string;
  width: number;
};

/**
 * Renders children in a fixed-size design coordinate space (`width` x `height`)
 * and scales it to fit the container, so absolutely positioned illustrations
 * keep their proportions at any viewport size.
 */
export const ScaledStage = ({
  children,
  height,
  label,
  width,
}: ScaledStageProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Null until measured so the unscaled stage is never painted.
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      // A hidden container reports 0; wait for a real width instead of
      // collapsing the stage to scale 0.
      if (container.clientWidth > 0) setScale(container.clientWidth / width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="relative w-full overflow-hidden"
      // aspect-ratio reserves the scaled height before hydration, so the
      // page layout doesn't shift when the scale is measured.
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 origin-top-left"
        style={{
          height,
          transform: `scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : "visible",
          width,
        }}
      >
        {children}
      </div>
    </div>
  );
};
