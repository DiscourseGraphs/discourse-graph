import {
  BREAK_DISTANCE,
  GROW_SECONDS,
  distanceBetween,
  getEdgeVisibility,
  getVisibilityAt,
  type GraphState,
  type Rect,
} from "./simulation";
import type { GraphColors } from "./colors";

export const EDGE_ALPHA = 0.14;
export const EDGE_MIN_ALPHA = 0.002;
export const NODE_ALPHA = 0.42;
const NODE_CAPTURE_ALPHA = 0.35;
const CAPTURE_SIZE_BOOST = 0.45;
// The sine argument is time / scale, so one cycle lasts 2π × scale (~11 s).
export const BREATHE_TIME_SCALE_MS = 1800;
export const BREATHE_AMOUNT = 0.12;
const FLASH_RING_ALPHA = 0.5;
const FLASH_RING_WIDTH = 1.5;
const FLASH_RING_GROWTH = 14;
const PULSE_GLOW_RADIUS = 12;
const PULSE_GLOW_ALPHA = 0.55;
const PULSE_CORE_RADIUS = 2;
const PULSE_CORE_ALPHA = 0.9;

const drawEdges = (
  context: CanvasRenderingContext2D,
  { state, colors }: { state: GraphState; colors: GraphColors },
): void => {
  for (const edge of state.edges) {
    const { from, to } = edge;
    const reach = Math.max(0, 1 - distanceBetween(from, to) / BREAK_DISTANCE);
    const grown = Math.min(1, edge.age / GROW_SECONDS);
    const eased = 1 - Math.pow(1 - grown, 3);
    const alpha =
      reach *
      getEdgeVisibility(edge) *
      Math.min(from.visibility, to.visibility) *
      EDGE_ALPHA;
    if (alpha <= EDGE_MIN_ALPHA) continue;
    context.strokeStyle = `rgba(${colors.edge}, ${alpha})`;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(from.rx, from.ry);
    context.lineTo(
      from.rx + (to.rx - from.rx) * eased,
      from.ry + (to.ry - from.ry) * eased,
    );
    context.stroke();
  }
};

const drawNodes = (
  context: CanvasRenderingContext2D,
  {
    state,
    colors,
    time,
  }: { state: GraphState; colors: GraphColors; time: number },
): void => {
  for (const node of state.nodes) {
    const breathe =
      1 + Math.sin(time / BREATHE_TIME_SCALE_MS + node.phase) * BREATHE_AMOUNT;
    const radius =
      node.radius * breathe * (1 + CAPTURE_SIZE_BOOST * node.capture);
    const alpha =
      (NODE_ALPHA + NODE_CAPTURE_ALPHA * node.capture) * node.visibility;
    context.fillStyle = `rgba(${node.color}, ${alpha})`;
    context.beginPath();
    context.arc(node.rx, node.ry, radius, 0, Math.PI * 2);
    context.fill();
    drawFlashRing(context, { node, radius, colors });
  }
};

// Shared with the lab graph so both backgrounds pulse the same way.
export const drawFlashRing = (
  context: CanvasRenderingContext2D,
  {
    node,
    radius,
    colors,
  }: {
    node: { rx: number; ry: number; flash: number; visibility: number };
    radius: number;
    colors: GraphColors;
  },
): void => {
  if (node.flash <= 0) return;
  context.strokeStyle = `rgba(${colors.pulse}, ${node.flash * FLASH_RING_ALPHA * node.visibility})`;
  context.lineWidth = FLASH_RING_WIDTH;
  context.beginPath();
  context.arc(
    node.rx,
    node.ry,
    radius + (1 - node.flash) * FLASH_RING_GROWTH,
    0,
    Math.PI * 2,
  );
  context.stroke();
};

export const drawPulseDot = (
  context: CanvasRenderingContext2D,
  {
    x,
    y,
    rects,
    colors,
  }: { x: number; y: number; rects: Rect[]; colors: GraphColors },
): void => {
  const visibility = getVisibilityAt({ rects, x, y });
  const glow = context.createRadialGradient(x, y, 0, x, y, PULSE_GLOW_RADIUS);
  glow.addColorStop(
    0,
    `rgba(${colors.pulse}, ${PULSE_GLOW_ALPHA * visibility})`,
  );
  glow.addColorStop(1, `rgba(${colors.pulse}, 0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, PULSE_GLOW_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = `rgba(${colors.pulse}, ${PULSE_CORE_ALPHA * visibility})`;
  context.beginPath();
  context.arc(x, y, PULSE_CORE_RADIUS, 0, Math.PI * 2);
  context.fill();
};

const drawPulses = (
  context: CanvasRenderingContext2D,
  { state, colors }: { state: GraphState; colors: GraphColors },
): void => {
  for (const pulse of state.pulses) {
    const start = pulse.forward ? pulse.edge.from : pulse.edge.to;
    const end = pulse.forward ? pulse.edge.to : pulse.edge.from;
    const eased = 1 - Math.pow(1 - pulse.progress, 2);
    drawPulseDot(context, {
      x: start.rx + (end.rx - start.rx) * eased,
      y: start.ry + (end.ry - start.ry) * eased,
      rects: state.avoidRects,
      colors,
    });
  }
};

export const drawGraph = (
  context: CanvasRenderingContext2D,
  {
    state,
    colors,
    time,
  }: { state: GraphState; colors: GraphColors; time: number },
): void => {
  context.clearRect(0, 0, state.width, state.height);
  drawEdges(context, { state, colors });
  drawNodes(context, { state, colors, time });
  drawPulses(context, { state, colors });
};
