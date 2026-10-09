"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

type ScaledStageProps = {
  children: ReactNode;
  height: number;
  label: string;
  width: number;
};

const supportsLengthDivision = (): boolean =>
  CSS.supports("transform", "scale(calc(100cqw / 570px))");

/**
 * Draws children in a fixed `width` x `height` coordinate space scaled to the
 * container. The scale is `100cqw / width` in CSS, so it works before
 * hydration and without JavaScript. Browsers that can't divide lengths in
 * `calc()` ignore it, so we measure the container instead.
 */
export const ScaledStage = ({
  children,
  height,
  label,
  width,
}: ScaledStageProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredScale, setMeasuredScale] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || supportsLengthDivision()) return;
    const update = () => {
      // A hidden container reports width 0; skip it rather than scale to 0.
      if (container.clientWidth > 0)
        setMeasuredScale(container.clientWidth / width);
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
      className="relative w-full overflow-hidden [container-type:inline-size]"
      // Reserves the scaled height so the layout doesn't shift on load.
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 origin-top-left"
        style={{
          height,
          transform:
            measuredScale === null
              ? `scale(calc(100cqw / ${width}px))`
              : `scale(${measuredScale})`,
          width,
        }}
      >
        {children}
      </div>
    </div>
  );
};
