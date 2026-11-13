import { afterEach, describe, it, expect, vi } from "vitest";
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

const COLORS = { pulse: "255, 140, 75", edge: "31, 31, 31" };

// A stand-in canvas that records the text and circles drawn on it.
const createRecordingContext = (): {
  context: CanvasRenderingContext2D;
  texts: string[];
  radii: number[];
} => {
  const texts: string[] = [];
  const radii: number[] = [];
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
    arc: (_x: number, _y: number, radius: number) => {
      radii.push(radius);
    },
    fill: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: (text: string) => {
      texts.push(text);
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    texts,
    radii,
  };
};

const drawFrame = (
  data: GrowthData,
  elapsed: number,
): { texts: string[]; radii: number[] } => {
  const { context, texts, radii } = createRecordingContext();
  drawGrowthFrame(context, {
    model: prepareGrowth(data),
    colors: COLORS,
    elapsed,
    width: 720,
    height: 540,
    fontFamily: "sans-serif",
  });
  return { texts, radii };
};

describe("drawGrowthFrame", () => {
  const draw = (elapsed: number): string[] => drawFrame(DATA, elapsed).texts;

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

describe("drawGrowthFrame at the end", () => {
  // Two nodes with one link each: one old, one made two days before the pull.
  const data: GrowthData = {
    ...DATA,
    nodes: [...DATA.nodes, [500, 500, 1, 1, 98, 1]],
  };
  // The graph is drawn before the legend, smallest nodes first, so the two
  // single-link nodes are the first two circles.
  const singleLinkRadii = (elapsed: number): number[] =>
    drawFrame(data, elapsed).radii.slice(0, 2);

  it("still enlarges the newest node when growth reaches the last day", () => {
    const [old = 0, newest = 0] = singleLinkRadii(
      GROWTH_TIMELINE.lead + GROWTH_TIMELINE.grow,
    );
    expect(Math.max(old, newest)).toBeGreaterThan(Math.min(old, newest));
  });

  it("settles every node to its normal size in the final frame", () => {
    const [first = 0, second = 0] = singleLinkRadii(GROWTH_DURATION);
    expect(first).toBeCloseTo(second);
  });
});

describe("the date label", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("names the month in UTC, whatever the local time zone", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    // 23:30 UTC on Sep 30 is already Oct 1 in Tokyo.
    const data: GrowthData = { ...DATA, t0: Date.UTC(2022, 8, 30, 23, 30) };
    expect(drawFrame(data, 0).texts[0]).toBe("Sep 2022");
  });
});
