import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLabGraphState,
  getLabNodeCount,
  resizeLabGraph,
  setLabAvoidRects,
  settleLabGraph,
  updateLabGraph,
  type LabGraphData,
  type LabGraphState,
} from "../../app/utils/graphBackground/labGraph";

const SIZE = { width: 1440, height: 630 };

// A ternary tree in breadth-first order, so every prefix is connected. Each
// link points from a child to its parent.
const TREE: LabGraphData = {
  types: ["QUE", "CLM", "EVD"],
  nodes: Array.from({ length: 200 }, (_, index) => index % 3),
  edges: Array.from({ length: 199 }, (_, index) => [
    index + 1,
    Math.floor(index / 3),
  ]).flat(),
};

// Evidence (2) -> claim (1) -> question (0).
const CHAIN: LabGraphData = {
  types: ["QUE", "CLM", "EVD"],
  nodes: [0, 1, 2],
  edges: [2, 1, 1, 0],
};

const buildState = ({
  data = TREE,
  size = SIZE,
}: {
  data?: LabGraphData;
  size?: { width: number; height: number };
} = {}): LabGraphState => {
  const state = createLabGraphState(data);
  resizeLabGraph(state, size);
  return state;
};

const run = (
  state: LabGraphState,
  {
    seconds,
    pointer = null,
  }: { seconds: number; pointer?: { x: number; y: number } | null },
): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    updateLabGraph(state, { delta: 0.05, pointer });
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getLabNodeCount", () => {
  it("scales with the canvas area", () => {
    expect(getLabNodeCount({ available: 200, ...SIZE })).toBe(81);
  });

  it("keeps a minimum on small screens and a maximum on large ones", () => {
    expect(getLabNodeCount({ available: 200, width: 300, height: 200 })).toBe(
      14,
    );
    expect(getLabNodeCount({ available: 200, width: 4000, height: 2000 })).toBe(
      130,
    );
  });

  it("never asks for more nodes than the data has", () => {
    expect(getLabNodeCount({ available: 3, ...SIZE })).toBe(3);
  });
});

describe("resizeLabGraph", () => {
  it("shows a connected prefix of the data", () => {
    const state = buildState();
    expect(state.nodes).toHaveLength(81);
    expect(state.edges).toHaveLength(80);
    for (const edge of state.edges) {
      expect(state.nodes).toContain(edge.from);
      expect(state.nodes).toContain(edge.to);
    }
  });

  it("lays the graph out inside the canvas", () => {
    const state = buildState();
    for (const node of state.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(SIZE.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(SIZE.height);
    }
  });

  it("centres the graph away from text", () => {
    const state = createLabGraphState(TREE);
    setLabAvoidRects(state, [
      { left: 0, top: 0, right: SIZE.width / 2, bottom: SIZE.height },
    ]);
    resizeLabGraph(state, SIZE);
    const meanX =
      state.nodes.reduce((sum, node) => sum + node.x, 0) / state.nodes.length;
    expect(meanX).toBeGreaterThan(SIZE.width / 2);
  });

  it("lays out nodes added by a resize without any animation frames", () => {
    const state = buildState({ size: { width: 768, height: 600 } });
    const before = [...state.nodes];
    resizeLabGraph(state, { width: 1200, height: 700 });
    expect(state.nodes.length).toBeGreaterThan(before.length);
    expect(state.nodes.slice(0, before.length)).toEqual(before);
    for (const node of state.nodes) {
      expect(Number.isFinite(node.rx)).toBe(true);
      expect(Number.isFinite(node.ry)).toBe(true);
    }
  });

  it("barely moves existing nodes on a small resize", () => {
    const state = buildState();
    const before = state.nodes.map((node) => ({ x: node.x, y: node.y }));
    resizeLabGraph(state, { width: SIZE.width + 6, height: SIZE.height });
    const moves = state.nodes
      .slice(0, before.length)
      .map((node, index) =>
        Math.hypot(
          node.x - (before[index]?.x ?? 0),
          node.y - (before[index]?.y ?? 0),
        ),
      )
      .sort((a, b) => a - b);
    expect(moves[Math.floor(moves.length / 2)]).toBeLessThan(10);
    expect(moves[moves.length - 1]).toBeLessThan(45);
  });

  it("moves its anchor when the text moves", () => {
    const state = createLabGraphState(TREE);
    setLabAvoidRects(state, [
      { left: 0, top: 0, right: SIZE.width / 2, bottom: SIZE.height },
    ]);
    resizeLabGraph(state, SIZE);
    expect(state.anchor?.x).toBeGreaterThan(SIZE.width / 2);
    setLabAvoidRects(state, [
      { left: SIZE.width / 2, top: 0, right: SIZE.width, bottom: SIZE.height },
    ]);
    expect(state.anchor?.x).toBeLessThan(SIZE.width / 2);
  });

  it("ignores a zero size and an unchanged size", () => {
    const state = buildState();
    const nodes = state.nodes;
    expect(resizeLabGraph(state, { width: 0, height: 0 })).toBe(false);
    expect(resizeLabGraph(state, SIZE)).toBe(false);
    expect(state.nodes).toBe(nodes);
  });
});

describe("updateLabGraph", () => {
  it("highlights the hovered node and its neighbors only", () => {
    const state = buildState();
    const hub = state.nodes[1];
    if (!hub) throw new Error("expected a node");
    const neighbors = new Set(
      hub.edges.flatMap((edge) => [edge.from, edge.to]),
    );
    const other = state.nodes.find((node) => !neighbors.has(node));
    run(state, { seconds: 1, pointer: { x: hub.rx, y: hub.ry } });
    expect(state.hovered).toBe(hub);
    expect(hub.highlight).toBeGreaterThan(0.9);
    for (const neighbor of neighbors) {
      if (neighbor !== hub) expect(neighbor.highlight).toBeGreaterThan(0.5);
    }
    expect(other?.highlight).toBeLessThan(0.01);
  });

  it("sends pulses along links in their direction and on up the chain", () => {
    const state = buildState({ data: CHAIN });
    const [question, claim, evidence] = state.nodes;
    vi.spyOn(Math, "random").mockReturnValue(0);
    state.secondsUntilPulse = 0;
    const travelled: [unknown, unknown][] = [];
    let questionFlashed = false;
    for (let frame = 0; frame < 120; frame++) {
      updateLabGraph(state, { delta: 0.05, pointer: null });
      questionFlashed ||= (question?.flash ?? 0) > 0;
      const pulse = state.pulses[0];
      const last = travelled[travelled.length - 1];
      if (pulse && (!last || last[0] !== pulse.edge.from)) {
        travelled.push([pulse.edge.from, pulse.edge.to]);
      }
    }
    expect(travelled).toEqual([
      [evidence, claim],
      [claim, question],
    ]);
    expect(questionFlashed).toBe(true);
  });
});

describe("settleLabGraph", () => {
  it("leaves a static, fully drawn frame", () => {
    const state = buildState();
    run(state, { seconds: 6, pointer: { x: 900, y: 300 } });
    settleLabGraph(state);
    expect(state.pulses).toEqual([]);
    expect(state.hovered).toBeNull();
    expect(state.lens).toBe(0);
    expect(state.nodes.every((node) => node.highlight === 0)).toBe(true);
  });
});
