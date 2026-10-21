export type Rect = { left: number; top: number; right: number; bottom: number };

export type Pointer = { x: number; y: number };

export type GraphNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  color: string;
  flash: number;
  // Drawn position: the drifting position (x, y) blended toward the cursor.
  rx: number;
  ry: number;
  capture: number;
  seed: number;
  // Fades nodes near text so it stays legible.
  visibility: number;
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  age: number;
  hold: number;
  fadeOverride: number | null;
};

export type Pulse = {
  edge: GraphEdge;
  forward: boolean;
  progress: number;
};

export type GraphState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  pulses: Pulse[];
  width: number;
  height: number;
  clock: number;
  secondsUntilPulse: number;
  avoidRects: Rect[];
  // Where captured nodes keep orbiting while they ease back after the cursor
  // has left.
  lastPointer: Pointer | null;
};

// No design token covers these node colors; only the pulse and edge colors
// come from the shared Tailwind config.
const NODE_COLORS = [
  "181, 52, 60",
  "181, 52, 60",
  "138, 138, 42",
  "120, 120, 120",
  "70, 90, 160",
];
const AREA_PER_NODE = 14000;
const MAX_NODES = 110;
const MAX_SPEED = 9;
const NODE_RADIUS_RANGE: [number, number] = [3.5, 6.5];
const LINK_DISTANCE = 170;
export const BREAK_DISTANCE = LINK_DISTANCE * 1.35;
const EDGES_PER_NODE = 1.1;
const EDGE_ATTEMPTS_PER_FRAME = 3;
const EDGE_HOLD_RANGE: [number, number] = [3, 7];
export const GROW_SECONDS = 1.4;
const FADE_SECONDS = 1.6;
const INITIAL_EDGE_AGE_RANGE: [number, number] = [
  GROW_SECONDS,
  GROW_SECONDS + 3,
];
const PULSE_SECONDS = 1.1;
const PULSE_INTERVAL_RANGE: [number, number] = [25, 45];
const FIRST_PULSE_DELAY_RANGE: [number, number] = [6, 10];
const PULSE_RETRY_SECONDS = 2;
const PULSE_MIN_VISIBILITY = 0.7;
const FLASH_DECAY_PER_SECOND = 1.2;
const POINTER_SIGMA = 110;
const CAPTURE_RATE = 4;
const CAPTURE_STRENGTH = 0.96;
const ORBIT_MIN = 4;
const ORBIT_SPREAD = 38;
const AVOID_DISTANCE = 80;
const AVOID_MIN_VISIBILITY = 0.12;
const MAX_FRAME_SECONDS = 0.05;

export const randomBetween = (range: [number, number]): number =>
  range[0] + Math.random() * (range[1] - range[0]);

export const smoothstep = ({
  low,
  high,
  value,
}: {
  low: number;
  high: number;
  value: number;
}): number => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// How strongly a point is inside a text block's quiet zone: 1 inside the
// block, easing to 0 at AVOID_DISTANCE away from it.
export const getAvoidance = ({
  rects,
  x,
  y,
}: {
  rects: Rect[];
  x: number;
  y: number;
}): number => {
  let strongest = 0;
  for (const rect of rects) {
    const outsideX = Math.max(rect.left - x, 0, x - rect.right);
    const outsideY = Math.max(rect.top - y, 0, y - rect.bottom);
    const weight =
      1 -
      smoothstep({
        low: 0,
        high: AVOID_DISTANCE,
        value: Math.hypot(outsideX, outsideY),
      });
    if (weight > strongest) strongest = weight;
  }
  return strongest;
};

const createNode = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): GraphNode => {
  const x = randomBetween([0, width]);
  const y = randomBetween([0, height]);
  return {
    x,
    y,
    rx: x,
    ry: y,
    capture: 0,
    seed: Math.random(),
    visibility: 1,
    vx: randomBetween([-MAX_SPEED, MAX_SPEED]),
    vy: randomBetween([-MAX_SPEED, MAX_SPEED]),
    radius: randomBetween(NODE_RADIUS_RANGE),
    phase: randomBetween([0, Math.PI * 2]),
    color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)] ?? "",
    flash: 0,
  };
};

export const distanceBetween = (a: GraphNode, b: GraphNode): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getFadeStart = (edge: GraphEdge): number =>
  edge.fadeOverride ?? GROW_SECONDS + edge.hold;

export const isEdgeSettled = (edge: GraphEdge): boolean =>
  edge.age >= GROW_SECONDS && edge.age < getFadeStart(edge);

export const getEdgeVisibility = (edge: GraphEdge): number => {
  const fadeProgress = (edge.age - getFadeStart(edge)) / FADE_SECONDS;
  return Math.max(0, 1 - Math.max(0, fadeProgress));
};

const hasEdgeBetween = ({
  edges,
  a,
  b,
}: {
  edges: GraphEdge[];
  a: GraphNode;
  b: GraphNode;
}): boolean =>
  edges.some(
    (edge) =>
      (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a),
  );

const findNearbyNode = ({
  nodes,
  edges,
  source,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: GraphNode;
}): GraphNode | null => {
  const candidates = nodes.filter(
    (node) =>
      node !== source &&
      distanceBetween(node, source) < LINK_DISTANCE &&
      !hasEdgeBetween({ edges, a: source, b: node }),
  );
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
};

const createEdge = ({
  from,
  to,
  age,
}: {
  from: GraphNode;
  to: GraphNode;
  age: number;
}): GraphEdge => ({
  from,
  to,
  age,
  hold: randomBetween(EDGE_HOLD_RANGE),
  fadeOverride: null,
});

export const createGraphState = (): GraphState => ({
  nodes: [],
  edges: [],
  pulses: [],
  width: 0,
  height: 0,
  clock: 0,
  secondsUntilPulse: randomBetween(FIRST_PULSE_DELAY_RANGE),
  avoidRects: [],
  lastPointer: null,
});

const growEdges = (
  state: GraphState,
  {
    initialAge,
    maxAttempts,
  }: { initialAge: () => number; maxAttempts: number },
): void => {
  const { nodes, edges } = state;
  const target = Math.round(nodes.length * EDGES_PER_NODE);
  let attempts = 0;
  while (edges.length < target && attempts++ < maxAttempts) {
    const source = nodes[Math.floor(Math.random() * nodes.length)];
    const neighbor = source && findNearbyNode({ nodes, edges, source });
    if (source && neighbor) {
      edges.push(createEdge({ from: source, to: neighbor, age: initialAge() }));
    }
  }
};

// How visible something drawn at (x, y) should be: 1 away from text, down to
// AVOID_MIN_VISIBILITY inside a text block.
export const getVisibilityAt = ({
  rects,
  x,
  y,
}: {
  rects: Rect[];
  x: number;
  y: number;
}): number => 1 - getAvoidance({ rects, x, y }) * (1 - AVOID_MIN_VISIBILITY);

const updateVisibility = (node: GraphNode, avoidRects: Rect[]): void => {
  node.visibility = getVisibilityAt({
    rects: avoidRects,
    x: node.rx,
    y: node.ry,
  });
};

const updateAllVisibility = (state: GraphState): void => {
  for (const node of state.nodes) updateVisibility(node, state.avoidRects);
};

export const setAvoidRects = (state: GraphState, rects: Rect[]): void => {
  state.avoidRects = rects;
  updateAllVisibility(state);
};

const keepInside = (
  node: GraphNode,
  { width, height }: { width: number; height: number },
): void => {
  if (node.x < 0) {
    node.x = 0;
    node.vx = Math.abs(node.vx);
  } else if (node.x > width) {
    node.x = width;
    node.vx = -Math.abs(node.vx);
  }
  if (node.y < 0) {
    node.y = 0;
    node.vy = Math.abs(node.vy);
  } else if (node.y > height) {
    node.y = height;
    node.vy = -Math.abs(node.vy);
  }
};

// Returns false when the size is unchanged. The first call builds the graph;
// later calls keep the existing nodes (rescaled) so resizes don't make it pop.
export const resizeGraph = (
  state: GraphState,
  { width, height }: { width: number; height: number },
): boolean => {
  // A hidden element reports 0x0; scaling to it would destroy the graph.
  if (width <= 0 || height <= 0) return false;
  const isFirstBuild = state.nodes.length === 0;
  if (!isFirstBuild && width === state.width && height === state.height) {
    return false;
  }
  const previous = { width: state.width, height: state.height };
  state.width = width;
  state.height = height;
  const count = Math.min(
    MAX_NODES,
    Math.round((width * height) / AREA_PER_NODE),
  );
  if (isFirstBuild) {
    state.nodes = Array.from({ length: count }, () =>
      createNode({ width, height }),
    );
  } else {
    const scaleX = previous.width > 0 ? width / previous.width : 1;
    const scaleY = previous.height > 0 ? height / previous.height : 1;
    for (const node of state.nodes) {
      node.x *= scaleX;
      node.y *= scaleY;
      node.rx *= scaleX;
      node.ry *= scaleY;
    }
    state.nodes = state.nodes.slice(0, count);
    while (state.nodes.length < count) {
      state.nodes.push(createNode({ width, height }));
    }
    const remaining = new Set(state.nodes);
    state.edges = state.edges.filter(
      (edge) => remaining.has(edge.from) && remaining.has(edge.to),
    );
    const liveEdges = new Set(state.edges);
    state.pulses = state.pulses.filter((pulse) => liveEdges.has(pulse.edge));
  }
  updateAllVisibility(state);
  // Also top up on resize: while the loop is stopped (reduced motion, off
  // screen) updateGraph never grows edges, so new nodes would stay unlinked.
  // Start mid-life so the frame already looks populated.
  growEdges(state, {
    initialAge: () => randomBetween(INITIAL_EDGE_AGE_RANGE),
    maxAttempts: state.nodes.length * EDGES_PER_NODE * 3,
  });
  return true;
};

// Particles near the cursor orbit it at their own radius and speed; the
// squared spread keeps most of them in a tight core. Capture is based on the
// drifting position, so nodes ease back once the cursor moves away.
const updateCapture = (
  node: GraphNode,
  {
    pointer,
    anchor,
    clock,
    delta,
  }: {
    pointer: Pointer | null;
    anchor: Pointer | null;
    clock: number;
    delta: number;
  },
): void => {
  const dx = pointer ? pointer.x - node.x : 0;
  const dy = pointer ? pointer.y - node.y : 0;
  const falloff = Math.exp(-(dx * dx + dy * dy) / (2 * POINTER_SIGMA ** 2));
  const target = pointer
    ? smoothstep({ low: 0.2, high: 0.6, value: falloff })
    : 0;
  node.capture += (target - node.capture) * Math.min(1, delta * CAPTURE_RATE);
  if (!anchor) {
    node.rx = node.x;
    node.ry = node.y;
    return;
  }
  const spread = (node.seed * 13.7) % 1;
  const orbit = ORBIT_MIN + ORBIT_SPREAD * spread * spread;
  const angle = clock * (1.4 + node.seed * 1.8) + node.seed * 40;
  const weight = node.capture * CAPTURE_STRENGTH;
  node.rx = node.x + (anchor.x + Math.cos(angle) * orbit - node.x) * weight;
  node.ry =
    node.y +
    (anchor.y + Math.sin(angle * 1.31 + node.seed * 6.28) * orbit - node.y) *
      weight;
};

// Returns whether a pulse started.
const startPulse = (state: GraphState): boolean => {
  const settled = state.edges.filter(
    (edge) =>
      isEdgeSettled(edge) &&
      Math.min(edge.from.visibility, edge.to.visibility) > PULSE_MIN_VISIBILITY,
  );
  const edge = settled[Math.floor(Math.random() * settled.length)];
  if (!edge) return false;
  state.pulses.push({ edge, forward: Math.random() < 0.5, progress: 0 });
  return true;
};

export const updateGraph = (
  state: GraphState,
  { delta, pointer }: { delta: number; pointer: Pointer | null },
): void => {
  const step = Math.min(Math.max(delta, 0), MAX_FRAME_SECONDS);
  state.clock += step;
  if (pointer) state.lastPointer = pointer;
  for (const node of state.nodes) {
    node.x += node.vx * step;
    node.y += node.vy * step;
    node.flash = Math.max(0, node.flash - step * FLASH_DECAY_PER_SECOND);
    updateCapture(node, {
      pointer,
      anchor: state.lastPointer,
      clock: state.clock,
      delta: step,
    });
    updateVisibility(node, state.avoidRects);
    keepInside(node, state);
  }

  for (const edge of state.edges) {
    edge.age += step;
    const stretched = distanceBetween(edge.from, edge.to) > BREAK_DISTANCE;
    // Skip edges already fading: moving their fade start to now would bring
    // them back to full opacity.
    const isFading = edge.age >= getFadeStart(edge);
    if (stretched && edge.fadeOverride === null && !isFading) {
      edge.fadeOverride = Math.max(edge.age, GROW_SECONDS);
    }
  }
  state.edges = state.edges.filter(
    (edge) => edge.age < getFadeStart(edge) + FADE_SECONDS,
  );
  growEdges(state, {
    initialAge: () => 0,
    maxAttempts: EDGE_ATTEMPTS_PER_FRAME,
  });

  state.secondsUntilPulse -= step;
  if (state.secondsUntilPulse <= 0) {
    state.secondsUntilPulse = startPulse(state)
      ? randomBetween(PULSE_INTERVAL_RANGE)
      : PULSE_RETRY_SECONDS;
  }
  for (const pulse of state.pulses) {
    pulse.progress += step / PULSE_SECONDS;
    if (pulse.progress >= 1) {
      (pulse.forward ? pulse.edge.to : pulse.edge.from).flash = 1;
    }
  }
  state.pulses = state.pulses.filter((pulse) => pulse.progress < 1);
};

// Static frame for reduced motion: no cursor cluster, no pulses in flight.
export const settleGraph = (state: GraphState): void => {
  state.pulses = [];
  state.lastPointer = null;
  for (const node of state.nodes) {
    node.capture = 0;
    node.rx = node.x;
    node.ry = node.y;
    node.flash = 0;
  }
  updateAllVisibility(state);
};
