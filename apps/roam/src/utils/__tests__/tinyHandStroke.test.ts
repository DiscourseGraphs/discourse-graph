import { describe, expect, it } from "vitest";
import {
  extendTinyHandStroke,
  startTinyHandStroke,
} from "~/components/canvas/tinyHand/tinyHandStroke";

describe("TinyHand stroke", () => {
  it("keeps pointer jitter within the tap threshold at different zoom levels", () => {
    const stroke = startTinyHandStroke({ x: 2, y: 3 });

    expect(extendTinyHandStroke(stroke, { x: 3, y: 4 }, 2)).toBe(stroke);
    expect(extendTinyHandStroke(stroke, { x: 6, y: 3 }, 0.5)).toBe(stroke);
  });

  it("builds a path from pointer-down once the drag threshold is reached", () => {
    const stroke = startTinyHandStroke({ x: 2, y: 3 });

    expect(extendTinyHandStroke(stroke, { x: 2, y: 5 }, 2).path).toBe(
      "M 2 3 L 2 5",
    );
  });

  it("preserves the last distinct direction for arrowheads", () => {
    const start = startTinyHandStroke({ x: 2, y: 3 });
    const stroke = extendTinyHandStroke(start, { x: 2, y: 7 }, 1);

    expect(extendTinyHandStroke(stroke, { x: 2, y: 7 }, 1)).toBe(stroke);
    expect(extendTinyHandStroke(stroke, { x: 7, y: 9 }, 1).path).toBe(
      "M 2 3 L 2 7 L 7 9",
    );
  });
});
