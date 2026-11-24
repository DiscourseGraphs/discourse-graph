export type Rect = { left: number; top: number; right: number; bottom: number };

export type Pointer = { x: number; y: number };

export type GraphNode = {
  // Position in `state.nodes`. With a real graph this is the node's renumbered
  // position in `state.topology`, not its index in the source data.
  index: number;
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

// A real graph the nodes follow, indexed by node position.
export type GraphTopology = {
  // Links inside a node's cluster. Linked nodes tether to each other.
  neighbors: number[][];
  // Every real link of each node, including the ones that cross between
  // clusters. Those form only when two nodes drift close; nothing pulls
  // clusters toward each other.
  links: number[][];
  // The cluster of each node, so nodes of different clusters can push apart.
  clusters: number[];
  // The color of each node, by its node type.
  colors: string[];
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
  // Null means any two nearby nodes can link.
  topology: GraphTopology | null;
  // Where captured nodes keep orbiting while they ease back after the cursor
  // has left.
  lastPointer: Pointer | null;
};

// No design token covers these node colors; only the pulse and edge colors
// come from the shared Tailwind config.
const RED = "181, 52, 60";
const OLIVE = "138, 138, 42";
const GRAY = "120, 120, 120";
const BLUE = "70, 90, 160";
const NODE_COLORS = [RED, RED, OLIVE, GRAY, BLUE];
// Colors by real node type: questions and requests blue, claims and hypotheses
// olive, evidence and results red, sources gray.
const NODE_TYPE_COLORS: Record<string, string> = {
  QUE: BLUE,
  ISS: BLUE,
  HYP: OLIVE,
  CLM: OLIVE,
  RES: RED,
  EVD: RED,
  SRC: GRAY,
};
const AREA_PER_NODE = 14000;
const MAX_NODES = 110;
const MAX_SPEED = 9;
const NODE_RADIUS_RANGE: [number, number] = [3.5, 6.5];
const LINK_DISTANCE = 170;
// Real neighbors drift back toward each other past this distance, so links
// keep forming between them instead of the graph diffusing apart.
const TETHER_DISTANCE = LINK_DISTANCE * 0.95;
const TETHER_SPEED = 28;
const OPEN_SPOT_ATTEMPTS = 12;
// Real graphs are cut into clusters of connected nodes of at most this size.
const CLUSTER_SIZE = 14;
const PAIR_KEY_STRIDE = 1 << 12;
// The tethers cancel much of the nodes' drift, so linked nodes start faster to
// move across the canvas as quickly as the unlinked nodes of the random graph.
const LINKED_SPEED_SCALE = 2.6;
// Nodes of a real graph closer than this ease apart, so linked clusters open
// up and fill the canvas instead of piling into dense knots. It stays below
// TETHER_DISTANCE so the push and the tether never fight over a pair.
const SPREAD_DISTANCE = LINK_DISTANCE * 0.7;
const SPREAD_SPEED = 16;
// A weaker, longer push between nodes of different clusters. The tethers hold
// each cluster together, so without it clusters bunch up and leave holes that
// the independent nodes of the random graph never have.
const CLUSTER_SPREAD_DISTANCE = 300;
const CLUSTER_SPREAD_SPEED = 14;
// Nodes this close to a wall ease away from it, so the push between nodes does
// not pile them up along the edges.
const WALL_PUSH_DISTANCE = SPREAD_DISTANCE / 2;
const SETTLE_STEPS = 300;
const SETTLE_STEP_SECONDS = 0.1;
export const BREAK_DISTANCE = LINK_DISTANCE * 1.35;
// Real links form and hold over a longer reach.
const REAL_LINK_DISTANCE = 240;
const REAL_BREAK_DISTANCE = REAL_LINK_DISTANCE * 1.35;
const EDGES_PER_NODE = 1.1;
// A real graph links only specific pairs, so more of them can be linked at
// once before it looks crowded.
const REAL_EDGES_PER_NODE = 1.8;
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

const randomBetween = (range: [number, number]): number =>
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
  index,
  near,
  color,
  at,
  speed = 1,
}: {
  width: number;
  height: number;
  index: number;
  color?: string;
  // A placed neighbor to start next to, so real links can form right away.
  near?: GraphNode;
  // Where to start a node that has no placed neighbor.
  at?: Pointer;
  // Scales the drift speed.
  speed?: number;
}): GraphNode => {
  const x = near
    ? Math.min(
        width,
        Math.max(
          0,
          near.x + randomBetween([-TETHER_DISTANCE, TETHER_DISTANCE]),
        ),
      )
    : (at?.x ?? randomBetween([0, width]));
  const y = near
    ? Math.min(
        height,
        Math.max(
          0,
          near.y + randomBetween([-TETHER_DISTANCE, TETHER_DISTANCE]),
        ),
      )
    : (at?.y ?? randomBetween([0, height]));
  return {
    index,
    x,
    y,
    rx: x,
    ry: y,
    capture: 0,
    seed: Math.random(),
    visibility: 1,
    vx: randomBetween([-MAX_SPEED, MAX_SPEED]) * speed,
    vy: randomBetween([-MAX_SPEED, MAX_SPEED]) * speed,
    radius: randomBetween(NODE_RADIUS_RANGE),
    phase: randomBetween([0, Math.PI * 2]),
    color:
      color ??
      NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)] ??
      "",
    flash: 0,
  };
};

export const distanceBetween = (a: GraphNode, b: GraphNode): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getFadeStart = (edge: GraphEdge): number =>
  edge.fadeOverride ?? GROW_SECONDS + edge.hold;

export const isEdgeSettled = (edge: GraphEdge): boolean =>
  edge.age >= GROW_SECONDS && edge.age < getFadeStart(edge);

// How far apart an edge's nodes can drift before it starts to fade away.
export const getBreakDistance = (state: GraphState): number =>
  state.topology ? REAL_BREAK_DISTANCE : BREAK_DISTANCE;

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

// Turns the flat [from, to, ...] link list of a real graph into per-node
// neighbor lists, ignoring link direction. A connected graph would pull itself
// into one blob, so it is cut into small clusters of connected nodes and only
// links inside a cluster are kept. Nodes are renumbered cluster by cluster,
// each in breadth-first order, so a node's earlier neighbor is already placed
// when it is added.
export const getNeighbors = ({
  nodeCount,
  edges,
  clusterSize,
}: {
  nodeCount: number;
  edges: number[];
  clusterSize: number;
}): {
  neighbors: number[][];
  links: number[][];
  clusters: number[];
  order: number[];
} => {
  const adjacent: number[][] = Array.from({ length: nodeCount }, () => []);
  for (let i = 0; i + 1 < edges.length; i += 2) {
    const from = edges[i] ?? -1;
    const to = edges[i + 1] ?? -1;
    adjacent[from]?.push(to);
    adjacent[to]?.push(from);
  }
  const newIndex = new Array<number>(nodeCount).fill(-1);
  const clusterOf = new Array<number>(nodeCount).fill(-1);
  const order: number[] = [];
  let clusterCount = 0;
  for (let start = 0; start < nodeCount; start++) {
    if (newIndex[start] !== -1) continue;
    const queue = [start];
    newIndex[start] = order.length;
    clusterOf[start] = clusterCount;
    order.push(start);
    let size = 1;
    for (let head = 0; head < queue.length && size < clusterSize; head++) {
      for (const next of adjacent[queue[head] ?? -1] ?? []) {
        if (newIndex[next] !== -1 || size >= clusterSize) continue;
        newIndex[next] = order.length;
        clusterOf[next] = clusterCount;
        order.push(next);
        queue.push(next);
        size++;
      }
    }
    clusterCount++;
  }
  // A node left with no link inside its cluster stays as a loose dot.
  const neighbors = order.map((original) =>
    (adjacent[original] ?? [])
      .filter((other) => clusterOf[other] === clusterOf[original])
      .map((other) => newIndex[other] ?? -1),
  );
  const links = order.map((original) =>
    (adjacent[original] ?? []).map((other) => newIndex[other] ?? -1),
  );
  const clusters = order.map((original) => clusterOf[original] ?? 0);
  return { neighbors, links, clusters, order };
};

export type LabGraphData = {
  types: string[];
  // One index into `types` per node.
  nodes: number[];
  // Flat [from, to, from, to, ...] node indices.
  edges: number[];
};

export const createTopology = ({
  data,
  clusterSize = CLUSTER_SIZE,
}: {
  data: LabGraphData;
  clusterSize?: number;
}): GraphTopology => {
  const { neighbors, links, clusters, order } = getNeighbors({
    nodeCount: data.nodes.length,
    edges: data.edges,
    clusterSize,
  });
  return {
    neighbors,
    links,
    clusters,
    // An unknown type draws in gray instead of an invalid color.
    colors: order.map(
      (original) =>
        NODE_TYPE_COLORS[data.types[data.nodes[original] ?? -1] ?? ""] ?? GRAY,
    ),
  };
};

export const createGraphState = (
  topology: GraphTopology | null = null,
): GraphState => ({
  nodes: [],
  edges: [],
  pulses: [],
  width: 0,
  height: 0,
  clock: 0,
  secondsUntilPulse: randomBetween(FIRST_PULSE_DELAY_RANGE),
  avoidRects: [],
  topology,
  lastPointer: null,
});

// Of a few random spots, the one farthest from every placed node, so the
// separate clusters of a real graph spread over the canvas.
const findOpenSpot = (
  state: GraphState,
  { width, height }: { width: number; height: number },
): Pointer => {
  let best = { x: randomBetween([0, width]), y: randomBetween([0, height]) };
  let bestDistance = -1;
  for (let attempt = 0; attempt < OPEN_SPOT_ATTEMPTS; attempt++) {
    const spot = {
      x: randomBetween([0, width]),
      y: randomBetween([0, height]),
    };
    let nearest = Infinity;
    for (const node of state.nodes) {
      nearest = Math.min(nearest, Math.hypot(node.x - spot.x, node.y - spot.y));
    }
    if (nearest > bestDistance) {
      best = spot;
      bestDistance = nearest;
    }
  }
  return best;
};

// Places the node at `index`, starting next to an already placed neighbor
// when the graph has real topology.
const addNode = (
  state: GraphState,
  { width, height }: { width: number; height: number },
): void => {
  const index = state.nodes.length;
  const { topology } = state;
  const near = topology?.neighbors[index]
    ?.map((other) => state.nodes[other])
    .find((node) => node !== undefined);
  const at =
    topology && !near ? findOpenSpot(state, { width, height }) : undefined;
  state.nodes.push(
    createNode({
      width,
      height,
      index,
      near,
      at,
      speed: topology ? LINKED_SPEED_SCALE : 1,
      color: topology?.colors[index],
    }),
  );
};

// Links a random real pair that is close enough and not yet linked. Picking
// from the pairs that qualify, instead of guessing, keeps the links coming
// even when few real neighbors happen to be in range.
const getPairKey = (a: number, b: number): number =>
  Math.min(a, b) * PAIR_KEY_STRIDE + Math.max(a, b);

const growRealEdges = (
  state: GraphState,
  { initialAge, maxNew }: { initialAge: () => number; maxNew: number },
): void => {
  const { nodes, edges, topology } = state;
  const target = Math.round(nodes.length * REAL_EDGES_PER_NODE);
  if (!topology || edges.length >= target) return;
  const linked = new Set(
    edges.map((edge) => getPairKey(edge.from.index, edge.to.index)),
  );
  const candidates: [GraphNode, GraphNode][] = [];
  for (const a of nodes) {
    for (const index of topology.links[a.index] ?? []) {
      const b = nodes[index];
      if (!b || index < a.index) continue;
      if (distanceBetween(a, b) >= REAL_LINK_DISTANCE) continue;
      if (linked.has(getPairKey(a.index, index))) continue;
      candidates.push([a, b]);
    }
  }
  let added = 0;
  while (candidates.length > 0 && edges.length < target && added++ < maxNew) {
    const pick = Math.floor(Math.random() * candidates.length);
    const [from, to] = candidates.splice(pick, 1)[0] ?? [];
    if (from && to) edges.push(createEdge({ from, to, age: initialAge() }));
  }
};

const growEdges = (
  state: GraphState,
  {
    initialAge,
    maxAttempts,
  }: { initialAge: () => number; maxAttempts: number },
): void => {
  const { nodes, edges } = state;
  if (state.topology) {
    growRealEdges(state, { initialAge, maxNew: maxAttempts });
    return;
  }
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
    state.nodes = [];
    while (state.nodes.length < count) addNode(state, { width, height });
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
      addNode(state, { width, height });
    }
    const remaining = new Set(state.nodes);
    state.edges = state.edges.filter(
      (edge) => remaining.has(edge.from) && remaining.has(edge.to),
    );
    const liveEdges = new Set(state.edges);
    state.pulses = state.pulses.filter((pulse) => liveEdges.has(pulse.edge));
  }
  // Let a real graph spread out before the first frame, not while on screen.
  if (isFirstBuild) {
    for (let i = 0; i < SETTLE_STEPS; i++) {
      relaxLayout(state, SETTLE_STEP_SECONDS);
    }
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

const spreadNodes = (state: GraphState, step: number): void => {
  const { nodes, topology, width, height } = state;
  if (!topology) return;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (!a || !b) continue;
      const distance = Math.max(distanceBetween(a, b), 1);
      const apart = topology.clusters[a.index] !== topology.clusters[b.index];
      const range = apart ? CLUSTER_SPREAD_DISTANCE : SPREAD_DISTANCE;
      if (distance >= range) continue;
      const speed = apart ? CLUSTER_SPREAD_SPEED : SPREAD_SPEED;
      const push = ((range - distance) / range) * speed * step;
      const dx = ((a.x - b.x) / distance) * push * 0.5;
      const dy = ((a.y - b.y) / distance) * push * 0.5;
      a.x += dx;
      a.y += dy;
      b.x -= dx;
      b.y -= dy;
    }
  }
  for (const node of nodes) {
    const away = (position: number, size: number): number =>
      (Math.max(0, WALL_PUSH_DISTANCE - position) -
        Math.max(0, WALL_PUSH_DISTANCE - (size - position))) /
      WALL_PUSH_DISTANCE;
    node.x += away(node.x, width) * SPREAD_SPEED * step;
    node.y += away(node.y, height) * SPREAD_SPEED * step;
  }
};

const tetherNeighbors = (state: GraphState, step: number): void => {
  const { topology, nodes } = state;
  if (!topology) return;
  for (const a of nodes) {
    for (const index of topology.neighbors[a.index] ?? []) {
      // Handle each pair once.
      const b = nodes[index];
      if (!b || index < a.index) continue;
      const distance = distanceBetween(a, b);
      if (distance <= TETHER_DISTANCE) continue;
      const pull = Math.min(distance - TETHER_DISTANCE, TETHER_SPEED * step);
      const dx = ((b.x - a.x) / distance) * pull * 0.5;
      const dy = ((b.y - a.y) / distance) * pull * 0.5;
      a.x += dx;
      a.y += dy;
      b.x -= dx;
      b.y -= dy;
    }
  }
};

// The pushes and the tether move positions directly, so nodes are kept on the
// canvas here instead of waiting for the next drift step to clamp them.
const containNodes = (state: GraphState): void => {
  for (const node of state.nodes) {
    node.x = Math.min(state.width, Math.max(0, node.x));
    node.y = Math.min(state.height, Math.max(0, node.y));
  }
};

const relaxLayout = (state: GraphState, step: number): void => {
  if (!state.topology) return;
  spreadNodes(state, step);
  tetherNeighbors(state, step);
  containNodes(state);
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
    const stretched =
      distanceBetween(edge.from, edge.to) > getBreakDistance(state);
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
  relaxLayout(state, step);
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
