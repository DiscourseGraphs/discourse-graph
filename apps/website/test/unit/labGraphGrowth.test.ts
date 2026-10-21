import { describe, it, expect } from "vitest";
import {
  GROWTH_DURATION,
  GROWTH_TIMELINE,
  NODE_TYPE_STYLES,
  drawGrowthFrame,
  getGrowthDay,
  prepareGrowth,
  type GrowthData,
} from "../../app/utils/labGraphGrowth";

const DATA: GrowthData = {
  pulledAt: new Date(Date.UTC(2026, 0, 101)).toISOString(),
  t0: Date.UTC(2026, 0, 1),
  W: 1200,
  H: 900,
  types: ["QUE", "EVD", "SRC"],
  // [x, y, type, degree, created day, community]
  nodes: [
    [100, 100, 0, 4, 0, 0],
    [120, 110, 1, 1, 10, 0],
    [900, 700, 2, 2, 30, 1],
  ],
  // Deliberately out of order, to check sorting.
  edges: [
    [1, 2, 0, 30],
    [0, 1, 1, 10],
  ],
};

describe("prepareGrowth", () => {
  const model = prepareGrowth(DATA);

  it("sorts links by day and marks links between communities", () => {
    expect(model.edges.map((edge) => edge.created)).toEqual([10, 30]);
    expect(model.edges.map((edge) => edge.across)).toEqual([false, true]);
    expect(model.edges.map((edge) => edge.formal)).toEqual([true, false]);
  });

  it("draws small nodes before hubs", () => {
    const radii = model.drawOrder.map((node) => node.radius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
  });

  it("ends on the day of the pull", () => {
    expect(model.lastDay).toBe(100);
  });

  it("skips links whose ends are missing", () => {
    const broken = prepareGrowth({ ...DATA, edges: [[0, 9, 1, 5]] });
    expect(broken.edges).toHaveLength(0);
  });
});

describe("getGrowthDay", () => {
  const model = prepareGrowth(DATA);

  it("holds before the first node during the lead-in", () => {
    expect(getGrowthDay({ model, elapsed: 0 })).toBeLessThan(0);
    expect(getGrowthDay({ model, elapsed: GROWTH_TIMELINE.lead })).toBe(
      getGrowthDay({ model, elapsed: 0 }),
    );
  });

  it("reaches the day of the pull at the end and stays there", () => {
    expect(getGrowthDay({ model, elapsed: GROWTH_DURATION })).toBe(100);
    expect(getGrowthDay({ model, elapsed: GROWTH_DURATION * 2 })).toBe(100);
  });

  it("advances linearly in between", () => {
    const halfway = GROWTH_TIMELINE.lead + GROWTH_TIMELINE.grow / 2;
    const start = getGrowthDay({ model, elapsed: 0 });
    expect(getGrowthDay({ model, elapsed: halfway })).toBeCloseTo(
      (start + 100) / 2,
    );
  });
});

// A stand-in canvas that records the text drawn on it.
const createRecordingContext = (): {
  context: CanvasRenderingContext2D;
  texts: string[];
} => {
  const texts: string[] = [];
  const noop = (): void => undefined;
  const context = {
    save: noop,
    restore: noop,
    scale: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    fill: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: (text: string) => {
      texts.push(text);
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, texts };
};

describe("drawGrowthFrame", () => {
  const model = prepareGrowth(DATA);
  const draw = (elapsed: number): string[] => {
    const { context, texts } = createRecordingContext();
    drawGrowthFrame(context, {
      model,
      elapsed,
      width: 720,
      height: 540,
      fontFamily: "sans-serif",
    });
    return texts;
  };

  it("shows only the date and the type labels, no counts", () => {
    const labels = DATA.types.map((type) => NODE_TYPE_STYLES[type]?.label);
    expect(draw(GROWTH_DURATION)).toEqual(["Apr 2026", ...labels]);
  });

  it("keeps the legend the same throughout", () => {
    expect(draw(GROWTH_TIMELINE.lead + 2000).slice(1)).toEqual(
      draw(GROWTH_DURATION).slice(1),
    );
  });
});
