import { useEffect, useState } from "react";
import type { Rect } from "./cardPosition";

// Grace period so a target that renders a moment after the step starts doesn't flash the fallback.
const MISSING_AFTER_MS = 600;

const isSameRect = (a: Rect | null, b: Rect | null): boolean =>
  a?.top === b?.top &&
  a?.left === b?.left &&
  a?.width === b?.width &&
  a?.height === b?.height;

const readRect = (selector: string): Rect | null => {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

/**
 * Tracks the target's position every frame so the spotlight follows sidebar animations,
 * but only re-renders when the position actually changes.
 */
export const useTargetRect = (
  selector: string | undefined,
): { rect: Rect | null; missing: boolean } => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setRect(null);
    setMissing(false);
    if (!selector) return;

    let lastRect: Rect | null = null;
    let absentSince = performance.now();
    let frameId = 0;
    const track = (now: number): void => {
      const nextRect = readRect(selector);
      if (!isSameRect(nextRect, lastRect)) {
        if (!nextRect) absentSince = now;
        lastRect = nextRect;
        setRect(nextRect);
      }
      setMissing(!nextRect && now - absentSince > MISSING_AFTER_MS);
      frameId = requestAnimationFrame(track);
    };
    frameId = requestAnimationFrame(track);

    return () => cancelAnimationFrame(frameId);
  }, [selector]);

  return { rect, missing };
};
