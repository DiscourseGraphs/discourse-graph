import {
  GROW_SECONDS,
  distanceBetween,
  getBreakDistance,
  getEdgeVisibility,
  getVisibilityAt,
  type GraphNode,
  type GraphState,
} from "./simulation";
import type { GraphColors } from "./colors";

const EDGE_ALPHA = 0.14;
const EDGE_MIN_ALPHA = 0.002;
const NODE_ALPHA = 0.42;
const NODE_CAPTURE_ALPHA = 0.35;
const CAPTURE_SIZE_BOOST = 0.45;
// The sine argument is time / scale, so one cycle lasts 2π × scale (~11 s).
const BREATHE_TIME_SCALE_MS = 1800;
const BREATHE_AMOUNT = 0.12;
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
  const breakDistance = getBreakDistance(state);
  for (const edge of state.edges) {
    const { from, to } = edge;
    const reach = Math.max(0, 1 - distanceBetween(from, to) / breakDistance);
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

const getNodeRadius = (node: GraphNode, time: number): number => {
  const breathe =
    1 + Math.sin(time / BREATHE_TIME_SCALE_MS + node.phase) * BREATHE_AMOUNT;
  return node.radius * breathe * (1 + CAPTURE_SIZE_BOOST * node.capture);
};

const drawNodes = (
  context: CanvasRenderingContext2D,
  {
    state,
    colors,
    time,
  }: { state: GraphState; colors: GraphColors; time: number },
): void => {
  // Clear the links under every node first, so none show through a node's
  // translucent fill. Clearing node by node would also cut the fills and flash
  // rings of nodes drawn earlier.
  context.globalCompositeOperation = "destination-out";
  for (const node of state.nodes) {
    // A node faded behind text clears proportionally less, so it leaves no gap in a link.
    context.fillStyle = `rgba(0, 0, 0, ${node.visibility})`;
    context.beginPath();
    context.arc(node.rx, node.ry, getNodeRadius(node, time), 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = "source-over";
  for (const node of state.nodes) {
    const radius = getNodeRadius(node, time);
    const alpha =
      (NODE_ALPHA + NODE_CAPTURE_ALPHA * node.capture) * node.visibility;
    context.fillStyle = `rgba(${node.color}, ${alpha})`;
    context.beginPath();
    context.arc(node.rx, node.ry, radius, 0, Math.PI * 2);
    context.fill();
    if (node.flash <= 0) continue;
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
  }
};

const drawPulses = (
  context: CanvasRenderingContext2D,
  { state, colors }: { state: GraphState; colors: GraphColors },
): void => {
  for (const pulse of state.pulses) {
    const start = pulse.forward ? pulse.edge.from : pulse.edge.to;
    const end = pulse.forward ? pulse.edge.to : pulse.edge.from;
    const eased = 1 - Math.pow(1 - pulse.progress, 2);
    const x = start.rx + (end.rx - start.rx) * eased;
    const y = start.ry + (end.ry - start.ry) * eased;
    const visibility = getVisibilityAt({ rects: state.avoidRects, x, y });
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
