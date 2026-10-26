// The MATSU lab discourse graph growing from its first node to the snapshot
// date, drawn on a 2D canvas. Node positions come precomputed in the data file
// (public/lab-graph/), so the browser only draws: no layout runs on the device.

import type { GraphColors } from "./graphBackground/colors";

// Shape of public/lab-graph/matsulab-growth.json. Positions are in a W x H
// layout space and dates are whole days since t0. Topology only: no titles.
export type GrowthData = {
  pulledAt: string;
  t0: number;
  W: number;
  H: number;
  types: string[];
  // [x, y, type index, degree, created day, community]
  nodes: number[][];
  // [node a, node b, formal (1) or informal (0), created day], sorted by day
  edges: number[][];
};

type GrowthNode = {
  x: number;
  y: number;
  type: number;
  radius: number;
  created: number;
  community: number;
};

type GrowthEdge = {
  from: GrowthNode;
  to: GrowthNode;
  formal: boolean;
  created: number;
  // Links between communities are drawn faint so they read as bridges.
  across: boolean;
};

export type GrowthModel = {
  width: number;
  height: number;
  t0: number;
  lastDay: number;
  types: string[];
  // Small nodes first so hubs are drawn on top.
  drawOrder: GrowthNode[];
  edges: GrowthEdge[];
};

// No design token covers the node type colors. Conclusions are counted as
// hypotheses upstream, so there is no CON entry.
export const NODE_TYPE_STYLES: Record<string, { label: string; rgb: string }> =
  {
    QUE: { label: "Question", rgb: "168, 142, 24" },
    ISS: { label: "Request", rgb: "52, 120, 160" },
    HYP: { label: "Hypothesis", rgb: "31, 94, 52" },
    CLM: { label: "Claim", rgb: "108, 156, 72" },
    RES: { label: "Result", rgb: "150, 62, 110" },
    EVD: { label: "Evidence", rgb: "181, 52, 60" },
    SRC: { label: "Source", rgb: "140, 140, 140" },
  };
const FALLBACK_RGB = "140, 140, 140";
const DAY_MS = 86_400_000;

// Milliseconds of each phase. The graph grows linearly in calendar time, then
// settles so the last nodes and links lose their "new" emphasis before the
// final frame holds.
export const GROWTH_TIMELINE = {
  lead: 500,
  grow: 10_000,
  settle: 400,
} as const;
export const GROWTH_DURATION =
  GROWTH_TIMELINE.lead + GROWTH_TIMELINE.grow + GROWTH_TIMELINE.settle;

// New formal links glow in the brand color for this many days; new nodes pop.
const FRESH_LINK_DAYS = 60;
const FRESH_NODE_DAYS = 45;
const NODE_POP = 0.9;
const NODE_ALPHA = 0.88;
const FORMAL_ALPHA = 0.3;
const INFORMAL_ALPHA = 0.09;
const ACROSS_FORMAL_ALPHA = 0.07;
const ACROSS_INFORMAL_ALPHA = 0.03;
const FRESH_ALPHA_BOOST = 0.45;
// Below this card width (CSS px), the date and legend are drawn smaller.
const COMPACT_WIDTH = 520;

const getNodeRadius = (degree: number): number =>
  Math.min(9, 1.6 + 1.05 * Math.sqrt(degree));

export const prepareGrowth = (data: GrowthData): GrowthModel => {
  const nodes = data.nodes.map(
    ([x = 0, y = 0, type = 0, degree = 0, created = 0, community = -1]) => ({
      x,
      y,
      type,
      radius: getNodeRadius(degree),
      created,
      community,
    }),
  );
  const edges: GrowthEdge[] = [];
  for (const [
    fromIndex = -1,
    toIndex = -1,
    formal = 0,
    created = 0,
  ] of data.edges) {
    const from = nodes[fromIndex];
    const to = nodes[toIndex];
    if (!from || !to) continue;
    edges.push({
      from,
      to,
      formal: formal === 1,
      created,
      across: from.community !== to.community,
    });
  }
  edges.sort((a, b) => a.created - b.created);
  return {
    width: data.W,
    height: data.H,
    t0: data.t0,
    lastDay: Math.round((new Date(data.pulledAt).getTime() - data.t0) / DAY_MS),
    types: data.types,
    drawOrder: [...nodes].sort((a, b) => a.radius - b.radius),
    edges,
  };
};

// The calendar day shown `elapsed` ms into the animation: a few days before
// the first node during the lead-in, then linear up to the day of the pull.
export const getGrowthDay = ({
  model,
  elapsed,
}: {
  model: GrowthModel;
  elapsed: number;
}): number => {
  const progress = Math.min(
    1,
    Math.max(0, (elapsed - GROWTH_TIMELINE.lead) / GROWTH_TIMELINE.grow),
  );
  const start = -20;
  return start + (model.lastDay - start) * progress;
};

type DrawContext = {
  context: CanvasRenderingContext2D;
  model: GrowthModel;
  colors: GraphColors;
  day: number;
  // The day used to age nodes and links. It runs past the last day while the
  // animation settles, so nothing still looks new in the final frame.
  ageDay: number;
  // Converts a size in CSS px to layout units.
  px: (cssPx: number) => number;
  compact: boolean;
  fontFamily: string;
};

const drawGraph = (
  { context, model, colors, day, ageDay }: DrawContext,
  { top, bottom }: { top: number; bottom: number },
): void => {
  const { width: W, height: H } = model;
  const scale = Math.min(1, (bottom - top) / (H * 0.92));
  const centerY = (top + bottom) / 2;
  const toX = (x: number): number => W / 2 + (x - W / 2) * scale;
  const toY = (y: number): number => centerY + (y - H / 2) * scale;

  // Informal links first, formal links on top.
  for (const formal of [false, true]) {
    for (const edge of model.edges) {
      if (edge.created > day) break;
      if (edge.formal !== formal) continue;
      const age = ageDay - edge.created;
      const fresh =
        formal && age < FRESH_LINK_DAYS ? 1 - age / FRESH_LINK_DAYS : 0;
      const base = formal
        ? edge.across
          ? ACROSS_FORMAL_ALPHA
          : FORMAL_ALPHA
        : edge.across
          ? ACROSS_INFORMAL_ALPHA
          : INFORMAL_ALPHA;
      context.strokeStyle =
        fresh > 0
          ? `rgba(${colors.pulse}, ${base + fresh * FRESH_ALPHA_BOOST})`
          : `rgba(${colors.edge}, ${base})`;
      context.lineWidth = (formal ? 0.8 + fresh * 0.8 : 0.6) * scale;
      context.beginPath();
      context.moveTo(toX(edge.from.x), toY(edge.from.y));
      context.lineTo(toX(edge.to.x), toY(edge.to.y));
      context.stroke();
    }
  }
  for (const node of model.drawOrder) {
    if (node.created > day) continue;
    const age = ageDay - node.created;
    const pop =
      age < FRESH_NODE_DAYS ? 1 + (1 - age / FRESH_NODE_DAYS) * NODE_POP : 1;
    const rgb =
      NODE_TYPE_STYLES[model.types[node.type] ?? ""]?.rgb ?? FALLBACK_RGB;
    context.fillStyle = `rgba(${rgb}, ${NODE_ALPHA})`;
    context.beginPath();
    context.arc(
      toX(node.x),
      toY(node.y),
      node.radius * scale * pop,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
};

// Only the date changes: this is an illustration, so it shows no counts that
// would pull attention from the text around it.
const drawDate = ({
  context,
  model,
  colors,
  day,
  px,
  compact,
  fontFamily,
}: DrawContext): void => {
  const date = new Date(model.t0 + Math.max(0, day) * DAY_MS);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = `rgba(${colors.edge}, 0.92)`;
  context.font = `700 ${px(compact ? 18 : 22)}px ${fontFamily}`;
  context.fillText(
    // Days are counted in UTC, so the month must be too.
    date.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    px(14),
    px(compact ? 28 : 32),
  );
};

const drawLegend = (
  { context, model, colors, px, compact, fontFamily }: DrawContext,
  { y }: { y: number },
): void => {
  context.font = `500 ${px(compact ? 10 : 11)}px ${fontFamily}`;
  context.textBaseline = "middle";
  const dot = px(3.2);
  const gap = px(compact ? 8 : 12);
  let x = px(14);
  let row = 0;
  for (const type of model.types) {
    const style = NODE_TYPE_STYLES[type];
    if (!style) continue;
    const itemWidth = dot * 2 + px(4) + context.measureText(style.label).width;
    if (x + itemWidth > model.width - px(10)) {
      x = px(14);
      row += 1;
    }
    const itemY = y + row * px(14);
    context.fillStyle = `rgb(${style.rgb})`;
    context.beginPath();
    context.arc(x + dot, itemY, dot, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `rgba(${colors.edge}, 0.68)`;
    context.fillText(style.label, x + dot * 2 + px(4), itemY);
    x += itemWidth + gap;
  }
  context.textBaseline = "alphabetic";
};

// Draws the frame `elapsed` ms into the animation. `width` and `height` are
// the canvas size in CSS px; the context must already be scaled for the
// device pixel ratio.
export const drawGrowthFrame = (
  context: CanvasRenderingContext2D,
  {
    model,
    colors,
    elapsed,
    width,
    height,
    fontFamily,
  }: {
    model: GrowthModel;
    colors: GraphColors;
    elapsed: number;
    width: number;
    height: number;
    fontFamily: string;
  },
): void => {
  const scale = width / model.width;
  const compact = width < COMPACT_WIDTH;
  const px = (cssPx: number): number => cssPx / scale;
  const layoutHeight = height / scale;
  const day = getGrowthDay({ model, elapsed });
  const settled = Math.min(
    1,
    Math.max(
      0,
      (elapsed - GROWTH_TIMELINE.lead - GROWTH_TIMELINE.grow) /
        GROWTH_TIMELINE.settle,
    ),
  );
  const frame: DrawContext = {
    context,
    model,
    colors,
    day,
    ageDay: day + settled * Math.max(FRESH_LINK_DAYS, FRESH_NODE_DAYS),
    px,
    compact,
    fontFamily,
  };
  context.save();
  context.scale(scale, scale);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, model.width, layoutHeight);
  drawGraph(frame, {
    top: px(compact ? 40 : 46),
    bottom: layoutHeight - px(compact ? 44 : 34),
  });
  drawDate(frame);
  drawLegend(frame, { y: layoutHeight - px(compact ? 30 : 14) });
  context.restore();
};
