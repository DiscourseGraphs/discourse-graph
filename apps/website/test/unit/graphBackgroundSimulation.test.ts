import { afterEach, describe, it, expect, vi } from "vitest";
import labGraph from "../../app/data/labGraph.json";
import { drawGraph } from "../../app/utils/graphBackground/draw";
import {
  createGraphState,
  createTopology,
  getAvoidance,
  getEdgeVisibility,
  getNeighbors,
  getVisibilityAt,
  isEdgeSettled,
  resizeGraph,
  setAvoidRects,
  settleGraph,
  smoothstep,
  updateGraph,
  type GraphState,
} from "../../app/utils/graphBackground/simulation";

const SIZE = { width: 1200, height: 600 };

const buildState = (size = SIZE): GraphState => {
  const state = createGraphState();
  resizeGraph(state, size);
  return state;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("smoothstep", () => {
  it("clamps outside the range and eases between the ends", () => {
    expect(smoothstep({ low: 0, high: 10, value: -5 })).toBe(0);
    expect(smoothstep({ low: 0, high: 10, value: 15 })).toBe(1);
    expect(smoothstep({ low: 0, high: 10, value: 5 })).toBe(0.5);
  });
});

describe("getAvoidance", () => {
  const rect = { left: 100, top: 100, right: 300, bottom: 200 };

  it("is 1 anywhere inside a block", () => {
    expect(getAvoidance({ rects: [rect], x: 200, y: 150 })).toBe(1);
  });

  it("falls to 0 once a point is far enough away", () => {
    expect(getAvoidance({ rects: [rect], x: 1000, y: 1000 })).toBe(0);
  });

  it("eases between inside and far away", () => {
    const near = getAvoidance({ rects: [rect], x: 320, y: 150 });
    const farther = getAvoidance({ rects: [rect], x: 360, y: 150 });
    expect(near).toBeGreaterThan(farther);
    expect(farther).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
  });

  it("uses the strongest block when several are given", () => {
    const other = { left: 900, top: 100, right: 1000, bottom: 200 };
    expect(getAvoidance({ rects: [rect, other], x: 950, y: 150 })).toBe(1);
    expect(getAvoidance({ rects: [], x: 950, y: 150 })).toBe(0);
  });
});

describe("getVisibilityAt", () => {
  const rect = { left: 100, top: 100, right: 300, bottom: 200 };

  it("is fully visible away from text and faint inside a block", () => {
    expect(getVisibilityAt({ rects: [rect], x: 1000, y: 1000 })).toBe(1);
    expect(getVisibilityAt({ rects: [rect], x: 200, y: 150 })).toBeCloseTo(
      0.12,
    );
  });

  it("is fully visible when there are no text blocks", () => {
    expect(getVisibilityAt({ rects: [], x: 200, y: 150 })).toBe(1);
  });
});

describe("resizeGraph", () => {
  it("builds nodes and a populated edge set on the first call", () => {
    const state = buildState();
    expect(state.nodes.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeLessThanOrEqual(
      Math.round(state.nodes.length * 1.1),
    );
  });

  it("reports no change for an identical size and keeps the same nodes", () => {
    const state = buildState();
    const before = [...state.nodes];
    expect(resizeGraph(state, SIZE)).toBe(false);
    expect(state.nodes).toHaveLength(before.length);
    state.nodes.forEach((node, index) => expect(node).toBe(before[index]));
  });

  it("ignores a zero-size resize instead of destroying the graph", () => {
    const state = buildState();
    const before = [...state.nodes];
    const edgeCount = state.edges.length;
    expect(resizeGraph(state, { width: 0, height: 0 })).toBe(false);
    expect(resizeGraph(state, { width: 0, height: 0 })).toBe(false);
    expect(state.nodes).toHaveLength(before.length);
    state.nodes.forEach((node, index) => expect(node).toBe(before[index]));
    expect(state.edges).toHaveLength(edgeCount);
    expect(state.width).toBe(SIZE.width);
  });

  it("builds the graph once a hidden element first gets a size", () => {
    const state = createGraphState();
    expect(resizeGraph(state, { width: 0, height: 0 })).toBe(false);
    expect(state.nodes).toHaveLength(0);
    expect(resizeGraph(state, SIZE)).toBe(true);
    expect(state.nodes.length).toBeGreaterThan(0);
  });

  it("keeps and rescales existing nodes when the size changes", () => {
    const state = buildState();
    const first = state.nodes[0];
    if (!first) throw new Error("expected a node");
    const { x, y } = first;
    expect(resizeGraph(state, { width: 600, height: 300 })).toBe(true);
    expect(state.nodes[0]).toBe(first);
    expect(first.x).toBeCloseTo(x / 2);
    expect(first.y).toBeCloseTo(y / 2);
  });

  it("links newly added nodes even when no frames run", () => {
    const state = buildState({ width: 600, height: 300 });
    state.edges = [];
    resizeGraph(state, SIZE);
    expect(state.nodes.length).toBeGreaterThan(13);
    expect(state.edges.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeLessThanOrEqual(
      Math.round(state.nodes.length * 1.1),
    );
  });

  it("drops edges and pulses that point at removed nodes", () => {
    const state = buildState();
    const [first, second] = state.nodes;
    const last = state.nodes[state.nodes.length - 1];
    if (!first || !second || !last) throw new Error("expected nodes");
    const makeEdge = (from: typeof first, to: typeof first) => ({
      from,
      to,
      age: 2,
      hold: 5,
      fadeOverride: null,
    });
    const keptEdge = makeEdge(first, second);
    const removedEdge = makeEdge(first, last);
    state.edges = [keptEdge, removedEdge];
    state.pulses = [
      { edge: keptEdge, forward: true, progress: 0.3 },
      { edge: removedEdge, forward: true, progress: 0.3 },
    ];

    // Shrinking the canvas removes the last few nodes (51 down to 47).
    resizeGraph(state, { width: 1100, height: 600 });

    expect(state.nodes).not.toContain(last);
    expect(state.edges).toContain(keptEdge);
    expect(state.edges).not.toContain(removedEdge);
    const remaining = new Set(state.nodes);
    for (const edge of state.edges) {
      expect(remaining.has(edge.from)).toBe(true);
      expect(remaining.has(edge.to)).toBe(true);
    }
    expect(state.pulses.map((pulse) => pulse.edge)).toEqual([keptEdge]);
  });
});

describe("updateGraph", () => {
  it("keeps every node inside the canvas", () => {
    const state = buildState({ width: 300, height: 200 });
    for (let i = 0; i < 600; i++)
      updateGraph(state, { delta: 0.05, pointer: null });
    for (const node of state.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(300);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(200);
    }
  });

  it("adds at most a few edges per frame", () => {
    const state = buildState();
    state.edges = [];
    updateGraph(state, { delta: 0.016, pointer: null });
    expect(state.edges.length).toBeLessThanOrEqual(3);
  });

  it("clamps very long frames", () => {
    const state = buildState();
    updateGraph(state, { delta: 10, pointer: null });
    expect(state.clock).toBeCloseTo(0.05);
  });

  it("ignores a negative frame time instead of stepping backwards", () => {
    const state = buildState();
    const node = state.nodes[0];
    if (!node) throw new Error("expected a node");
    const { x, y } = node;
    updateGraph(state, { delta: -0.02, pointer: null });
    expect(state.clock).toBe(0);
    expect(node.x).toBe(x);
    expect(node.y).toBe(y);
  });

  it("captures nodes near the pointer and releases them gradually", () => {
    const state = buildState();
    const node = state.nodes[0];
    if (!node) throw new Error("expected a node");
    const pointer = { x: node.x, y: node.y };
    for (let i = 0; i < 60; i++) updateGraph(state, { delta: 0.05, pointer });
    expect(node.capture).toBeGreaterThan(0.9);

    updateGraph(state, { delta: 0.05, pointer: null });
    expect(node.capture).toBeGreaterThan(0);
    expect(node.capture).toBeLessThan(1);
    for (let i = 0; i < 120; i++) {
      updateGraph(state, { delta: 0.05, pointer: null });
    }
    expect(node.capture).toBeLessThan(0.01);
  });

  it("fades nodes drawn inside a text block", () => {
    const state = buildState();
    const node = state.nodes[0];
    if (!node) throw new Error("expected a node");
    setAvoidRects(state, [
      {
        left: node.rx - 5,
        top: node.ry - 5,
        right: node.rx + 5,
        bottom: node.ry + 5,
      },
    ]);
    expect(node.visibility).toBeCloseTo(0.12);
    setAvoidRects(state, []);
    expect(node.visibility).toBe(1);
  });

  it("starts a pulse on a settled, visible edge once its timer elapses", () => {
    const state = buildState();
    for (const edge of state.edges) edge.age = 2;
    state.secondsUntilPulse = 0;
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    updateGraph(state, { delta: 0.016, pointer: null });
    expect(state.pulses).toHaveLength(1);
    expect(state.secondsUntilPulse).toBeGreaterThanOrEqual(25);
  });
});

describe("stretched edges", () => {
  const stretchEdgeEnds = (state: GraphState) => {
    const [from, to] = state.nodes;
    if (!from || !to) throw new Error("expected nodes");
    from.x = 0;
    from.y = 0;
    to.x = 1000;
    to.y = 0;
    from.vx = from.vy = to.vx = to.vy = 0;
    return { from, to };
  };

  it("starts fading an edge that is still settled when its ends drift apart", () => {
    const state = buildState();
    const { from, to } = stretchEdgeEnds(state);
    const edge = { from, to, age: 2, hold: 5, fadeOverride: null };
    state.edges = [edge];
    updateGraph(state, { delta: 0.016, pointer: null });
    expect(edge.fadeOverride).not.toBeNull();
    expect(isEdgeSettled(edge)).toBe(false);
  });

  it("does not restart the fade of an edge that is already fading", () => {
    const state = buildState();
    const { from, to } = stretchEdgeEnds(state);
    // Natural fade starts at 1.4 + 4 = 5.4s, so this edge is about half faded.
    const edge = { from, to, age: 6.2, hold: 4, fadeOverride: null };
    state.edges = [edge];
    const before = getEdgeVisibility(edge);
    updateGraph(state, { delta: 0.016, pointer: null });
    expect(edge.fadeOverride).toBeNull();
    expect(getEdgeVisibility(edge)).toBeLessThan(before);
  });
});

describe("pulse timing", () => {
  it("retries soon when no edge is ready for a pulse", () => {
    const state = buildState();
    for (const edge of state.edges) edge.age = 0;
    state.secondsUntilPulse = 0;
    updateGraph(state, { delta: 0.016, pointer: null });
    expect(state.pulses).toHaveLength(0);
    expect(state.secondsUntilPulse).toBeGreaterThan(0);
    expect(state.secondsUntilPulse).toBeLessThanOrEqual(2);
  });
});

describe("settleGraph", () => {
  it("clears pulses and pointer capture for the static frame", () => {
    const state = buildState();
    const node = state.nodes[0];
    if (!node) throw new Error("expected a node");
    node.capture = 1;
    node.rx = 0;
    state.pulses = [{ edge: state.edges[0]!, forward: true, progress: 0.5 }];
    settleGraph(state);
    expect(state.pulses).toHaveLength(0);
    expect(node.capture).toBe(0);
    expect(node.rx).toBe(node.x);
  });
});

describe("edge lifecycle", () => {
  const edge = {
    from: {} as never,
    to: {} as never,
    hold: 4,
    fadeOverride: null,
  };

  it("grows, settles, then fades out", () => {
    expect(isEdgeSettled({ ...edge, age: 0.5 })).toBe(false);
    expect(isEdgeSettled({ ...edge, age: 3 })).toBe(true);
    expect(getEdgeVisibility({ ...edge, age: 3 })).toBe(1);
    expect(getEdgeVisibility({ ...edge, age: 5.4 + 0.8 })).toBeCloseTo(0.5);
    expect(getEdgeVisibility({ ...edge, age: 20 })).toBe(0);
  });

  it("starts fading early when marked stretched", () => {
    expect(isEdgeSettled({ ...edge, age: 2, fadeOverride: 1.5 })).toBe(false);
    expect(
      getEdgeVisibility({ ...edge, age: 2.3, fadeOverride: 1.5 }),
    ).toBeLessThan(1);
  });
});

describe("getNeighbors", () => {
  it("keeps only links inside a cluster and renumbers nodes cluster by cluster", () => {
    // 0-1-2 and 3-4 are connected; 2-3 links the two groups.
    const { neighbors } = getNeighbors({
      nodeCount: 5,
      edges: [0, 1, 1, 2, 2, 3, 3, 4],
      clusterSize: 3,
    });
    expect(neighbors).toEqual([[1], [0, 2], [1], [4], [3]]);
  });

  it("lists links that cross between clusters apart from in-cluster neighbors", () => {
    const { neighbors, links } = getNeighbors({
      nodeCount: 5,
      edges: [0, 1, 1, 2, 2, 3, 3, 4],
      clusterSize: 3,
    });
    expect(neighbors[2]).toEqual([1]);
    expect(links[2]).toEqual([1, 3]);
  });
});

const mulberry32 = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const HERO_SIZE = { width: 1440, height: 700 };

const buildLabState = (): GraphState => {
  const state = createGraphState(createTopology({ data: labGraph }));
  resizeGraph(state, HERO_SIZE);
  return state;
};

// Average distance a node moves per second over `seconds` of drift.
const measureSpeed = (state: GraphState, seconds: number): number => {
  const step = 0.05;
  let travelled = 0;
  for (let time = 0; time < seconds; time += step) {
    const before = state.nodes.map((node) => [node.x, node.y]);
    updateGraph(state, { delta: step, pointer: null });
    state.nodes.forEach((node, i) => {
      const [x = 0, y = 0] = before[i] ?? [];
      travelled += Math.hypot(node.x - x, node.y - y);
    });
  }
  return travelled / state.nodes.length / seconds;
};

describe("real graph", () => {
  const data = {
    types: ["QUE", "EVD", "NEW"],
    nodes: [0, 1, 2, 1],
    edges: [0, 1, 1, 2, 2, 3],
  };

  it("colors nodes by type and draws an unknown type in gray", () => {
    const { colors } = createTopology({ data, clusterSize: 10 });
    expect(colors[0]).toBe("70, 90, 160");
    expect(colors[1]).toBe("181, 52, 60");
    expect(colors[2]).toBe("120, 120, 120");
    expect(colors).toHaveLength(4);
  });

  it("only links nodes that are linked in the data", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(7));
    const topology = createTopology({ data: labGraph });
    const state = createGraphState(topology);
    resizeGraph(state, HERO_SIZE);
    for (let i = 0; i < 400; i++) {
      updateGraph(state, { delta: 0.05, pointer: null });
    }
    expect(state.edges.length).toBeGreaterThan(0);
    for (const edge of state.edges) {
      expect(topology.links[edge.from.index]).toContain(edge.to.index);
    }
  });

  it("keeps every node on the canvas after the first build and while drifting", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(11));
    const state = buildLabState();
    const isInside = (node: { x: number; y: number }): boolean =>
      node.x >= 0 &&
      node.x <= HERO_SIZE.width &&
      node.y >= 0 &&
      node.y <= HERO_SIZE.height;
    expect(state.nodes.every(isInside)).toBe(true);
    for (let i = 0; i < 400; i++) {
      updateGraph(state, { delta: 0.05, pointer: null });
    }
    expect(state.nodes.every(isInside)).toBe(true);
  });

  it("drifts about as fast as the random graph", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(3));
    const random = buildState(HERO_SIZE);
    const real = buildLabState();
    const ratio = measureSpeed(real, 60) / measureSpeed(random, 60);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
  });
});

describe("drawing nodes over links", () => {
  const colors = { pulse: "255, 140, 75", edge: "31, 31, 31" };

  const draw = (
    state: GraphState,
  ): {
    operations: string[];
    strokeStyles: string[];
    clearStyles: string[];
  } => {
    const operations: string[] = [];
    const strokeStyles: string[] = [];
    const clearStyles: string[] = [];
    const gradient = { addColorStop: () => undefined };
    const properties: Record<string, unknown> = {};
    const context = new Proxy(properties, {
      get: (target, name: string) =>
        name in target
          ? target[name]
          : name === "createRadialGradient"
            ? () => gradient
            : () => undefined,
      set: (target, name: string, value: unknown) => {
        if (name === "globalCompositeOperation") operations.push(String(value));
        if (name === "strokeStyle") strokeStyles.push(String(value));
        if (name === "fillStyle" && operations.at(-1) === "destination-out") {
          clearStyles.push(String(value));
        }
        target[name] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawGraph(context, { state, colors, time: 0 });
    return { operations, strokeStyles, clearStyles };
  };

  // One settled link between two nodes `distance` apart, and nothing else.
  const withOneLink = (state: GraphState, distance: number): GraphState => {
    const [from, to] = state.nodes;
    if (!from || !to) throw new Error("expected two nodes");
    for (const node of state.nodes) node.flash = 0;
    from.x = from.rx = 100;
    from.y = from.ry = 100;
    to.x = to.rx = 100 + distance;
    to.y = to.ry = 100;
    state.edges = [{ from, to, age: 3, hold: 5, fadeOverride: null }];
    state.pulses = [];
    return state;
  };

  const edgeStrokes = (strokeStyles: string[]): string[] =>
    strokeStyles.filter((style) => style.startsWith("rgba(31, 31, 31,"));

  it("clears the links under the nodes of the real graph", () => {
    expect(draw(buildLabState()).operations).toContain("destination-out");
  });

  it("clears the links under the nodes of the random graph", () => {
    expect(draw(buildState(HERO_SIZE)).operations).toContain("destination-out");
  });

  it("clears less under a node that is faded behind text", () => {
    const state = buildLabState();
    for (const node of state.nodes) node.visibility = 1;
    const [hidden] = state.nodes;
    if (!hidden) throw new Error("expected a node");
    hidden.visibility = 0;
    const { clearStyles } = draw(state);
    expect(clearStyles).toContain("rgba(0, 0, 0, 0)");
    expect(clearStyles).toContain("rgba(0, 0, 0, 1)");
  });

  it("clears every node's links in one pass before any node is filled", () => {
    expect(draw(buildLabState()).operations).toEqual([
      "destination-out",
      "source-over",
    ]);
  });

  it("keeps a real link visible out to the distance where it breaks", () => {
    // Real links reach further than the random graph's, so 280px is still
    // inside their fade range.
    const { strokeStyles } = draw(withOneLink(buildLabState(), 280));
    expect(edgeStrokes(strokeStyles)).toHaveLength(1);
  });

  it("fades the random graph's links out at its own shorter distance", () => {
    const { strokeStyles } = draw(withOneLink(buildState(HERO_SIZE), 280));
    expect(edgeStrokes(strokeStyles)).toHaveLength(0);
  });
});
