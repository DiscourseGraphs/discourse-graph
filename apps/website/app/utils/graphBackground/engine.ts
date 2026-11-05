import labGraphData from "~/data/labGraph.json";
import type { GraphColors } from "./colors";
import { drawGraph } from "./draw";
import { drawLabGraph } from "./drawLabGraph";
import {
  createLabGraphState,
  resizeLabGraph,
  setLabAvoidRects,
  settleLabGraph,
  updateLabGraph,
} from "./labGraph";
import {
  createGraphState,
  resizeGraph,
  setAvoidRects,
  settleGraph,
  updateGraph,
  type Pointer,
  type Rect,
} from "./simulation";

export type GraphKind = "random" | "lab";

// What the canvas component drives each frame, whichever graph is behind it.
type GraphEngine = {
  resize: (size: { width: number; height: number }) => boolean;
  setAvoidRects: (rects: Rect[]) => void;
  update: (input: { delta: number; pointer: Pointer | null }) => void;
  settle: () => void;
  draw: (
    context: CanvasRenderingContext2D,
    input: { colors: GraphColors; time: number },
  ) => void;
};

const createRandomGraphEngine = (): GraphEngine => {
  const state = createGraphState();
  return {
    resize: (size) => resizeGraph(state, size),
    setAvoidRects: (rects) => setAvoidRects(state, rects),
    update: (input) => updateGraph(state, input),
    settle: () => settleGraph(state),
    draw: (context, { colors, time }) =>
      drawGraph(context, { state, colors, time }),
  };
};

const createLabGraphEngine = (): GraphEngine => {
  const state = createLabGraphState(labGraphData);
  return {
    resize: (size) => resizeLabGraph(state, size),
    setAvoidRects: (rects) => setLabAvoidRects(state, rects),
    update: (input) => updateLabGraph(state, input),
    settle: () => settleLabGraph(state),
    draw: (context, { colors, time }) =>
      drawLabGraph(context, { state, colors, time }),
  };
};

export const createGraphEngine = (kind: GraphKind): GraphEngine =>
  kind === "lab" ? createLabGraphEngine() : createRandomGraphEngine();
