import type { GraphColors } from "./colors";
import {
  BREATHE_AMOUNT,
  BREATHE_TIME_SCALE_MS,
  EDGE_ALPHA,
  EDGE_MIN_ALPHA,
  NODE_ALPHA,
  drawFlashRing,
  drawPulseDot,
} from "./draw";
import type { LabGraphState } from "./labGraph";

// The random background's olive and red, plus a green for claims at a similar
// saturation. The green is lighter than both so claims don't blur into them;
// for red-green colorblind viewers it is about as distinct as olive is from red.
const NODE_TYPE_COLORS: Record<string, string> = {
  QUE: "138, 138, 42",
  CLM: "127, 192, 140",
  EVD: "181, 52, 60",
};
const FALLBACK_NODE_COLOR = "120, 120, 120";

const HIGHLIGHT_EDGE_ALPHA = 0.3;
const NODE_HIGHLIGHT_ALPHA = 0.25;
const HIGHLIGHT_SIZE_BOOST = 0.25;

const drawEdges = (
  context: CanvasRenderingContext2D,
  { state, colors }: { state: LabGraphState; colors: GraphColors },
): void => {
  for (const { from, to, highlight } of state.edges) {
    const alpha =
      (EDGE_ALPHA + (HIGHLIGHT_EDGE_ALPHA - EDGE_ALPHA) * highlight) *
      Math.min(from.visibility, to.visibility);
    if (alpha <= EDGE_MIN_ALPHA) continue;
    context.strokeStyle = `rgba(${colors.edge}, ${alpha})`;
    context.lineWidth = 1 + highlight * 0.2;
    context.beginPath();
    context.moveTo(from.rx, from.ry);
    context.lineTo(to.rx, to.ry);
    context.stroke();
  }
};

const drawNodes = (
  context: CanvasRenderingContext2D,
  {
    state,
    colors,
    time,
  }: { state: LabGraphState; colors: GraphColors; time: number },
): void => {
  for (const node of state.nodes) {
    const breathe =
      1 + Math.sin(time / BREATHE_TIME_SCALE_MS + node.phase) * BREATHE_AMOUNT;
    const radius =
      node.radius * breathe * (1 + HIGHLIGHT_SIZE_BOOST * node.highlight);
    const alpha =
      (NODE_ALPHA + NODE_HIGHLIGHT_ALPHA * node.highlight) * node.visibility;
    const type = state.data.types[node.type] ?? "";
    const color = NODE_TYPE_COLORS[type] ?? FALLBACK_NODE_COLOR;
    context.fillStyle = `rgba(${color}, ${alpha})`;
    context.beginPath();
    context.arc(node.rx, node.ry, radius, 0, Math.PI * 2);
    context.fill();
    drawFlashRing(context, { node, radius, colors });
  }
};

const drawPulses = (
  context: CanvasRenderingContext2D,
  { state, colors }: { state: LabGraphState; colors: GraphColors },
): void => {
  for (const pulse of state.pulses) {
    const { from, to } = pulse.edge;
    const eased = 1 - Math.pow(1 - pulse.progress, 2);
    drawPulseDot(context, {
      x: from.rx + (to.rx - from.rx) * eased,
      y: from.ry + (to.ry - from.ry) * eased,
      rects: state.avoidRects,
      colors,
    });
  }
};

export const drawLabGraph = (
  context: CanvasRenderingContext2D,
  {
    state,
    colors,
    time,
  }: { state: LabGraphState; colors: GraphColors; time: number },
): void => {
  context.clearRect(0, 0, state.width, state.height);
  drawEdges(context, { state, colors });
  drawNodes(context, { state, colors, time });
  drawPulses(context, { state, colors });
};
