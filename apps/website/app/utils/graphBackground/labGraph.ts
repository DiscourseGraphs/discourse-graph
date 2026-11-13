// A graph background whose nodes and links come from the MATSU lab discourse
// graph. Unlike the random background, the links never change: a force layout
// spreads the graph over the canvas and drawn positions wander around it.
import {
  getVisibilityAt,
  randomBetween,
  type Pointer,
  type Rect,
} from "./simulation";

export type LabGraphData = {
  types: string[];
  // One index into `types` per node, in the order the subgraph was grown from
  // one seed node, so any prefix of the list is a connected subgraph.
  nodes: number[];
  // Flat [from, to, from, to, ...] node indices. Each link points from the
  // node that supports or informs to the node it supports or informs, mostly
  // evidence toward claims and questions. Pulses travel that way.
  edges: number[];
};

type LabNode = {
  index: number;
  type: number;
  radius: number;
  // Layout position, moved by the force layout.
  x: number;
  y: number;
  // Drawn position: layout position plus wander, drift and the cursor lens.
  rx: number;
  ry: number;
  phase: number;
  seed: number;
  visibility: number;
  flash: number;
  highlight: number;
  edges: LabEdge[];
  outgoing: LabEdge[];
};

type LabEdge = {
  from: LabNode;
  to: LabNode;
  highlight: number;
};

type LabPulse = {
  edge: LabEdge;
  progress: number;
  duration: number;
  hops: number;
};

export type LabGraphState = {
  data: LabGraphData;
  nodes: LabNode[];
  edges: LabEdge[];
  pulses: LabPulse[];
  width: number;
  height: number;
  clock: number;
  spacing: number;
  secondsUntilPulse: number;
  avoidRects: Rect[];
  // The layout pulls the graph toward the centre of the largest text-free area.
  anchor: Pointer | null;
  driftPhase: number;
  pointer: Pointer | null;
  // The cursor lens eases in and out around the last pointer position.
  lens: number;
  lensCenter: Pointer | null;
  hovered: LabNode | null;
};

const AREA_PER_NODE = 11200;
const MIN_NODES = 14;
const MAX_NODES = 130;
const LAYOUT_TICKS = 320;
// Resizes settle gently from the current layout instead of restarting it, so
// nodes don't jump while a window is dragged.
const RESIZE_LAYOUT_TICKS = 30;
const RESIZE_START_STEP = 4;
const REPULSION = 0.55;
const ATTRACTION = 1.6;
const GRAVITY = 0.12;
// Weaker horizontal pull, so the graph spreads along the wide hero instead of
// gathering into a disc.
const HORIZONTAL_GRAVITY = GRAVITY * 0.3;
const WALL_MARGIN = 50;
const WALL_PUSH = 0.5;
const SETTLED_STEP = 0.6;
const WANDER_AMOUNT = 9;
const DRIFT_AMOUNT = 18;
const LENS_SIGMA = 120;
// Magnification at the cursor is 1 + LENS_STRENGTH, easing to 1 further out.
const LENS_STRENGTH = 0.35;
const LENS_RATE = 4;
const HOVER_DISTANCE = 36;
const HIGHLIGHT_RATE = 6;
const PULSE_SPEED = 120;
const PULSE_INTERVAL_RANGE: [number, number] = [6, 12];
const FIRST_PULSE_DELAY_RANGE: [number, number] = [3, 5];
const PULSE_RETRY_SECONDS = 1.5;
const PULSE_CONTINUE_CHANCE = 0.8;
const PULSE_MAX_HOPS = 4;
const PULSE_MIN_VISIBILITY = 0.7;
const FLASH_DECAY_PER_SECOND = 1.2;
const MAX_FRAME_SECONDS = 0.05;

export const createLabGraphState = (data: LabGraphData): LabGraphState => ({
  data,
  nodes: [],
  edges: [],
  pulses: [],
  width: 0,
  height: 0,
  clock: 0,
  spacing: 0,
  secondsUntilPulse: randomBetween(FIRST_PULSE_DELAY_RANGE),
  avoidRects: [],
  anchor: null,
  driftPhase: Math.random() * Math.PI * 2,
  pointer: null,
  lens: 0,
  lensCenter: null,
  hovered: null,
});

export const getLabNodeCount = ({
  available,
  width,
  height,
}: {
  available: number;
  width: number;
  height: number;
}): number =>
  Math.min(
    available,
    MAX_NODES,
    Math.max(MIN_NODES, Math.round((width * height) / AREA_PER_NODE)),
  );

const getRadius = (degree: number): number =>
  Math.min(7.5, 2.8 + 1.15 * Math.sqrt(degree));

// The grid point with the most text-free space around it. A plain centroid of
// the free space can land behind the text when there is free space on both
// sides of it.
const getOpenCenter = (state: LabGraphState): Pointer => {
  const columns = 24;
  const rows = 10;
  const samples: { x: number; y: number; open: number }[] = [];
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const x = (state.width * i) / columns;
      const y = (state.height * j) / rows;
      const open = getVisibilityAt({ rects: state.avoidRects, x, y }) ** 4;
      samples.push({ x, y, open });
    }
  }
  const reach = Math.min(state.width, state.height) * 0.45;
  let best = { x: state.width / 2, y: state.height / 2 };
  let bestScore = -Infinity;
  for (const candidate of samples) {
    let score = 0;
    for (const sample of samples) {
      const distance = Math.hypot(
        sample.x - candidate.x,
        sample.y - candidate.y,
      );
      score += sample.open * Math.exp(-((distance / reach) ** 2));
    }
    if (score > bestScore) {
      bestScore = score;
      best = { x: candidate.x, y: candidate.y };
    }
  }
  return best;
};

const createNode = ({
  index,
  type,
}: {
  index: number;
  type: number;
}): LabNode => ({
  index,
  type,
  radius: getRadius(0),
  x: Number.NaN,
  y: Number.NaN,
  rx: 0,
  ry: 0,
  phase: Math.random() * Math.PI * 2,
  seed: Math.random(),
  visibility: 1,
  flash: 0,
  highlight: 0,
  edges: [],
  outgoing: [],
});

const linkNodes = (state: LabGraphState, nodes: LabNode[]): LabEdge[] => {
  const previous = new Map(
    state.edges.map((edge) => [`${edge.from.index}:${edge.to.index}`, edge]),
  );
  for (const node of nodes) {
    node.edges = [];
    node.outgoing = [];
  }
  const edges: LabEdge[] = [];
  const { edges: flat } = state.data;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const from = nodes[flat[i] ?? -1];
    const to = nodes[flat[i + 1] ?? -1];
    if (!from || !to) continue;
    const edge = previous.get(`${from.index}:${to.index}`) ?? {
      from,
      to,
      highlight: 0,
    };
    edges.push(edge);
    from.edges.push(edge);
    to.edges.push(edge);
    from.outgoing.push(edge);
  }
  return edges;
};

// Grows or shrinks the shown prefix of the data. Nodes already shown are kept;
// new ones start next to a neighbor that is already placed. Every node is
// drawn as soon as it exists, so a resize with the animation stopped (reduced
// motion, off screen) still shows the whole graph.
const syncNodes = (state: LabGraphState, count: number): void => {
  const nodes = state.data.nodes
    .slice(0, count)
    .map((type, index) => state.nodes[index] ?? createNode({ index, type }));
  const edges = linkNodes(state, nodes);
  const anchor = state.anchor ?? { x: state.width / 2, y: state.height / 2 };
  const jitter = state.spacing * 0.3;
  for (const node of nodes) {
    node.radius = getRadius(node.edges.length);
    if (!Number.isNaN(node.x)) continue;
    const neighbor = node.edges
      .map((edge) => (edge.from === node ? edge.to : edge.from))
      .find((other) => !Number.isNaN(other.x));
    const base = neighbor ?? anchor;
    node.x = base.x + randomBetween([-jitter, jitter]);
    node.y = base.y + randomBetween([-jitter, jitter]);
    node.rx = node.x;
    node.ry = node.y;
  }
  state.nodes = nodes;
  state.edges = edges;
  const live = new Set(edges);
  state.pulses = state.pulses.filter((pulse) => live.has(pulse.edge));
  if (state.hovered && !nodes.includes(state.hovered)) state.hovered = null;
};

// Soft walls ease nodes back in rather than pinning them, which would flatten
// the graph into lines along the edges.
const getWallPush = ({
  position,
  size,
}: {
  position: number;
  size: number;
}): number => {
  if (position < WALL_MARGIN) return (WALL_MARGIN - position) * WALL_PUSH;
  if (position > size - WALL_MARGIN) {
    return (size - WALL_MARGIN - position) * WALL_PUSH;
  }
  return 0;
};

// One step of a Fruchterman-Reingold style layout with gravity toward the
// anchor. Text blocks are not pushed against: that piles nodes up along their
// edges, so nodes behind text just fade. Each node moves at most `maxStep`.
const relax = (state: LabGraphState, maxStep: number): void => {
  const { nodes, edges, spacing, width, height } = state;
  const anchor = state.anchor ?? { x: width / 2, y: height / 2 };
  const count = nodes.length;
  const dx = new Float64Array(count);
  const dy = new Float64Array(count);
  const repulsion = (spacing * REPULSION) ** 2;
  const cutoff = spacing * 1.6;
  for (let i = 0; i < count; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < count; j++) {
      const b = nodes[j]!;
      const ox = a.x - b.x;
      const oy = a.y - b.y;
      if (Math.abs(ox) > cutoff || Math.abs(oy) > cutoff) continue;
      const distance = Math.max(1, Math.hypot(ox, oy));
      const force = repulsion / (distance * distance);
      dx[i]! += ox * force;
      dy[i]! += oy * force;
      dx[j]! -= ox * force;
      dy[j]! -= oy * force;
    }
  }
  for (const { from, to } of edges) {
    const ox = from.x - to.x;
    const oy = from.y - to.y;
    const force = (Math.max(1, Math.hypot(ox, oy)) * ATTRACTION) / spacing;
    dx[from.index]! -= ox * force;
    dy[from.index]! -= oy * force;
    dx[to.index]! += ox * force;
    dy[to.index]! += oy * force;
  }
  for (const node of nodes) {
    let moveX =
      dx[node.index]! +
      (anchor.x - node.x) * HORIZONTAL_GRAVITY +
      getWallPush({ position: node.x, size: width });
    let moveY =
      dy[node.index]! +
      (anchor.y - node.y) * GRAVITY +
      getWallPush({ position: node.y, size: height });
    const length = Math.hypot(moveX, moveY);
    if (length > maxStep) {
      moveX = (moveX / length) * maxStep;
      moveY = (moveY / length) * maxStep;
    }
    node.x = Math.min(width, Math.max(0, node.x + moveX));
    node.y = Math.min(height, Math.max(0, node.y + moveY));
  }
};

const runLayout = (
  state: LabGraphState,
  { ticks, startStep }: { ticks: number; startStep: number },
): void => {
  for (let tick = 0; tick < ticks; tick++) {
    const cooling = 1 - tick / ticks;
    relax(state, Math.max(SETTLED_STEP, startStep * cooling * cooling));
  }
};

const updateDrawnPositions = (state: LabGraphState): void => {
  const { clock, lens, lensCenter } = state;
  const driftAngle = clock * 0.07 + state.driftPhase;
  const driftX = Math.cos(driftAngle) * DRIFT_AMOUNT;
  const driftY = Math.sin(driftAngle * 1.3) * DRIFT_AMOUNT * 0.7;
  for (const node of state.nodes) {
    let x =
      node.x +
      driftX +
      Math.sin(clock * (0.12 + node.seed * 0.1) + node.phase) * WANDER_AMOUNT;
    let y =
      node.y +
      driftY +
      Math.cos(clock * (0.1 + node.seed * 0.08) + node.phase * 1.7) *
        WANDER_AMOUNT;
    // Fisheye: spread nodes apart around the cursor so a dense patch opens up
    // instead of clumping.
    if (lensCenter && lens > 0.001) {
      const ox = x - lensCenter.x;
      const oy = y - lensCenter.y;
      const falloff = Math.exp(-(ox * ox + oy * oy) / (2 * LENS_SIGMA ** 2));
      const scale = 1 + LENS_STRENGTH * falloff * lens;
      x = lensCenter.x + ox * scale;
      y = lensCenter.y + oy * scale;
    }
    node.rx = x;
    node.ry = y;
    node.visibility = getVisibilityAt({ rects: state.avoidRects, x, y });
  }
};

// Text can reflow after load (breakpoints, fonts), so the anchor follows it.
export const setLabAvoidRects = (state: LabGraphState, rects: Rect[]): void => {
  state.avoidRects = rects;
  if (state.width > 0) state.anchor = getOpenCenter(state);
  updateDrawnPositions(state);
};

// Returns false when the size is unchanged.
export const resizeLabGraph = (
  state: LabGraphState,
  { width, height }: { width: number; height: number },
): boolean => {
  // A hidden element reports 0x0; scaling to it would destroy the layout.
  if (width <= 0 || height <= 0) return false;
  const isFirstBuild = state.nodes.length === 0;
  if (!isFirstBuild && width === state.width && height === state.height) {
    return false;
  }
  if (!isFirstBuild) {
    const scaleX = width / state.width;
    const scaleY = height / state.height;
    for (const node of state.nodes) {
      node.x *= scaleX;
      node.y *= scaleY;
    }
  }
  state.width = width;
  state.height = height;
  state.anchor = getOpenCenter(state);
  const count = getLabNodeCount({
    available: state.data.nodes.length,
    width,
    height,
  });
  state.spacing = Math.sqrt((width * height) / count);
  syncNodes(state, count);
  runLayout(
    state,
    isFirstBuild
      ? { ticks: LAYOUT_TICKS, startStep: state.spacing * 1.2 }
      : { ticks: RESIZE_LAYOUT_TICKS, startStep: RESIZE_START_STEP },
  );
  updateDrawnPositions(state);
  return true;
};

const startPulse = (
  state: LabGraphState,
  { edge, hops }: { edge?: LabEdge; hops: number },
): boolean => {
  const candidates = edge
    ? [edge]
    : state.edges.filter(
        (option) =>
          Math.min(option.from.visibility, option.to.visibility) >
          PULSE_MIN_VISIBILITY,
      );
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  if (!chosen) return false;
  const length = Math.hypot(
    chosen.to.rx - chosen.from.rx,
    chosen.to.ry - chosen.from.ry,
  );
  state.pulses.push({
    edge: chosen,
    progress: 0,
    duration: Math.min(1.6, Math.max(0.6, length / PULSE_SPEED)),
    hops,
  });
  return true;
};

const updatePulses = (state: LabGraphState, step: number): void => {
  state.secondsUntilPulse -= step;
  if (state.secondsUntilPulse <= 0) {
    state.secondsUntilPulse = startPulse(state, { hops: 0 })
      ? randomBetween(PULSE_INTERVAL_RANGE)
      : PULSE_RETRY_SECONDS;
  }
  const arrived: LabPulse[] = [];
  for (const pulse of state.pulses) {
    pulse.progress += step / pulse.duration;
    if (pulse.progress >= 1) arrived.push(pulse);
  }
  state.pulses = state.pulses.filter((pulse) => pulse.progress < 1);
  // A pulse that reaches a node usually carries on along one of its outgoing
  // links, so support visibly travels along chains of links.
  for (const pulse of arrived) {
    const node = pulse.edge.to;
    node.flash = 1;
    if (pulse.hops + 1 >= PULSE_MAX_HOPS) continue;
    if (Math.random() > PULSE_CONTINUE_CHANCE) continue;
    const next = node.outgoing.filter(
      (edge) => edge.to.visibility > PULSE_MIN_VISIBILITY,
    );
    const edge = next[Math.floor(Math.random() * next.length)];
    if (edge) startPulse(state, { edge, hops: pulse.hops + 1 });
  }
};

const findHoveredNode = (state: LabGraphState): LabNode | null => {
  const { pointer } = state;
  if (!pointer) return null;
  let hovered: LabNode | null = null;
  let nearest = HOVER_DISTANCE;
  for (const node of state.nodes) {
    if (node.visibility < 0.5) continue;
    const distance = Math.hypot(node.rx - pointer.x, node.ry - pointer.y);
    if (distance < nearest) {
      nearest = distance;
      hovered = node;
    }
  }
  return hovered;
};

// The hovered node and its direct neighbors brighten.
const updateHighlights = (state: LabGraphState, step: number): void => {
  const hovered = findHoveredNode(state);
  state.hovered = hovered;
  const neighbors = new Set(
    hovered?.edges.flatMap((edge) => [edge.from, edge.to]) ?? [],
  );
  const rate = Math.min(1, step * HIGHLIGHT_RATE);
  for (const node of state.nodes) {
    const target = node === hovered ? 1 : neighbors.has(node) ? 0.6 : 0;
    node.highlight += (target - node.highlight) * rate;
  }
  for (const edge of state.edges) {
    const target = hovered && hovered.edges.includes(edge) ? 1 : 0;
    edge.highlight += (target - edge.highlight) * rate;
  }
};

export const updateLabGraph = (
  state: LabGraphState,
  { delta, pointer }: { delta: number; pointer: Pointer | null },
): void => {
  const step = Math.min(Math.max(delta, 0), MAX_FRAME_SECONDS);
  state.clock += step;
  state.pointer = pointer;
  if (pointer) state.lensCenter = pointer;
  state.lens +=
    ((pointer ? 1 : 0) - state.lens) * Math.min(1, step * LENS_RATE);
  relax(state, SETTLED_STEP);
  updateDrawnPositions(state);
  for (const node of state.nodes) {
    node.flash = Math.max(0, node.flash - step * FLASH_DECAY_PER_SECOND);
  }
  updateHighlights(state, step);
  updatePulses(state, step);
};

// Static frame for reduced motion: no lens, highlights or pulses in flight.
export const settleLabGraph = (state: LabGraphState): void => {
  state.pulses = [];
  state.pointer = null;
  state.lens = 0;
  state.hovered = null;
  for (const node of state.nodes) {
    node.flash = 0;
    node.highlight = 0;
  }
  for (const edge of state.edges) edge.highlight = 0;
  updateDrawnPositions(state);
};
