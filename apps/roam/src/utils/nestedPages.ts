// Pure logic for nested sub-page portals (dg-subpage): tier-2 prefix derivation,
// lineage walking, the preview classifier, scale-to-fit layout, and label
// thresholds. Everything here is editor-free and node-testable; the shape util
// (DgSubpageUtil.tsx) maps live editor records into the plain descriptors below.
//
// Schema (see dg-prototypes/nested-pages/SPEC.md §3): pages stay flat siblings;
// a target page records `meta.dgNested.parentPageId` (the page its portal lives
// on) and the portal shape holds the forward pointer in `props.targetPageId`.

// Classifier tag for portal boxes inside previews. NOT a persisted tldraw shape
// type: portals persist as native `geo` shapes carrying `meta.dgSubpage`, so a
// plugin version without this feature still loads the board (an unknown shape
// type would make loadSnapshot throw and blank the whole canvas there).
export const SUBPAGE_SHAPE_TYPE = "dg-subpage";

export const SUBPAGE_HEADER_HEIGHT = 40;
export const SUBPAGE_SUBTITLE_HEIGHT = 18;
export const SUBPAGE_BODY_PADDING = 8;
// Smallest scaled box that still shows its full title / its type code.
export const TITLE_MIN_W = 44;
export const TITLE_MIN_H = 13;
export const CODE_MIN_W = 20;
export const CODE_MIN_H = 10;
export const MAX_LINEAGE_DEPTH = 16;

export type NestedPageMeta = {
  parentPageId: string;
  ownerShapeId?: string;
};

// `ownerShapeId` is informational only — nothing reads it, and a back-pointer is
// always recoverable by scanning portals for props.targetPageId === page.id.
export const getNestedPageMeta = (meta: unknown): NestedPageMeta | null => {
  if (typeof meta !== "object" || meta === null) return null;
  const dgNested = (meta as { dgNested?: unknown }).dgNested;
  if (typeof dgNested !== "object" || dgNested === null) return null;
  const { parentPageId, ownerShapeId } = dgNested as {
    parentPageId?: unknown;
    ownerShapeId?: unknown;
  };
  if (typeof parentPageId !== "string" || !parentPageId) return null;
  return {
    parentPageId,
    ...(typeof ownerShapeId === "string" ? { ownerShapeId } : {}),
  };
};

export type SubpageMeta = {
  /** Forward pointer to the page this portal opens. */
  targetPageId: string;
  /** Header color (hex). */
  accent?: string;
  /** Title fallback for when the target page is missing; the live render
   * prefers the current page name. Also mirrored into the geo label text so
   * old clients see a named rectangle. */
  title?: string;
  subtitle?: string;
};

// A shape is a portal exactly when its meta carries dgSubpage. Kept meta-based
// (not a custom shape type) for backward compatibility — see SUBPAGE_SHAPE_TYPE.
export const getSubpageMeta = (meta: unknown): SubpageMeta | null => {
  if (typeof meta !== "object" || meta === null) return null;
  const dgSubpage = (meta as { dgSubpage?: unknown }).dgSubpage;
  if (typeof dgSubpage !== "object" || dgSubpage === null) return null;
  const { targetPageId, accent, title, subtitle } = dgSubpage as {
    targetPageId?: unknown;
    accent?: unknown;
    title?: unknown;
    subtitle?: unknown;
  };
  if (typeof targetPageId !== "string" || !targetPageId) return null;
  return {
    targetPageId,
    ...(typeof accent === "string" ? { accent } : {}),
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof subtitle === "string" ? { subtitle } : {}),
  };
};

export type PrefixMatcher = {
  prefix: string;
  nodeType: string;
  regex: RegExp;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A node format like `[[QUE]] - {content}` yields the prefix "QUE": everything
// before the first placeholder, with page brackets and trailing separator
// punctuation removed. Formats that begin with the placeholder (Page, Block)
// yield nothing — those nodes are untyped from a label's point of view.
const derivePrefix = (format: string): string | null => {
  const head = format.split("{")[0] ?? "";
  const prefix = head
    .replace(/\[\[|\]\]/g, "")
    .replace(/[\s:\-–—]+$/g, "")
    .trim();
  return prefix.length > 0 ? prefix : null;
};

export const buildPrefixMatchers = (
  nodes: { type: string; format?: string }[],
): PrefixMatcher[] => {
  const matchers = nodes.flatMap((node) => {
    const prefix = node.format ? derivePrefix(node.format) : null;
    if (!prefix) return [];
    // \b only makes sense when the prefix ends in a word character ("QUE" must
    // not match "QUESTIONS", but a prefix like "@" has no word boundary).
    const boundary = /\w$/.test(prefix) ? "\\b" : "";
    // Roam titles literally contain the bracketed format ("[[EVD]] - …"), so
    // the brackets are optional parts of the match and get stripped with it.
    return [
      {
        prefix,
        nodeType: node.type,
        regex: new RegExp(
          `^\\s*(?:\\[\\[\\s*)?${escapeRegExp(prefix)}${boundary}(?:\\s*\\]\\])?[\\s:\\-–—]*`,
          "i",
        ),
      },
    ];
  });
  // Longest prefix first so e.g. "EVD-X" can never be shadowed by "EVD".
  return matchers.sort((a, b) => b.prefix.length - a.prefix.length);
};

export type LineagePage = { id: string; name: string };

// Root-first chain ending at `currentPageId`. Cycles cannot be prevented at
// write time (programmatic meta writes can't be policed), so the walk carries a
// visited-set and a depth cap.
export const walkLineage = (
  getPage: (
    id: string,
  ) => { id: string; name: string; parentPageId?: string } | null | undefined,
  currentPageId: string,
): LineagePage[] => {
  const chain: LineagePage[] = [];
  const seen = new Set<string>();
  let page = getPage(currentPageId);
  while (page && !seen.has(page.id) && chain.length < MAX_LINEAGE_DEPTH) {
    seen.add(page.id);
    chain.unshift({ id: page.id, name: page.name });
    page = page.parentPageId ? getPage(page.parentPageId) : null;
  }
  return chain;
};

export type PreviewBoxKind =
  | "node"
  | "portal"
  | "frame"
  | "image"
  | "text"
  | "geo";

export type PreviewShapeDescriptor = {
  id: string;
  type: string;
  /** Page-space bounds (getShapePageBounds); null when unavailable. */
  bounds: { x: number; y: number; w: number; h: number } | null;
  /** Plain text: node title, geo/text label. */
  text?: string;
  /** discourse-node shapes: props.nodeTypeId. */
  nodeTypeId?: string;
  /** discourse-node imageUrl, or the resolved asset src of an image shape. */
  imageUrl?: string;
  portalTitle?: string;
  portalAccent?: string;
  frameName?: string;
  /** tldraw color style name for plain geo shapes. */
  colorStyle?: string;
};

export type PreviewBox = {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PreviewBoxKind;
  z: number;
  title?: string;
  /** Type code shown when the box is too small for its title. */
  code?: string;
  /** Discourse node type id (tier 1 from props, tier 2 from the label prefix). */
  nodeType?: string;
  /** Explicit color (portal accent). */
  color?: string;
  img?: string;
  colorStyle?: string;
};

export type PreviewModel = {
  count: number;
  boxes: PreviewBox[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

// Preview stacking: frames behind, then boxes/portals, then nodes and text,
// images on top. Within a class, input order is kept (sort is stable).
const Z: Record<PreviewBoxKind, number> = {
  frame: 0,
  geo: 1,
  portal: 1,
  node: 2,
  text: 2,
  image: 3,
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

// One box per shape, in page coordinates. Arrows are skipped (their bounds span
// between endpoints and would inflate the fitted bounds — relations don't
// appear in previews). Groups are skipped (the page shape listing already
// includes their children). Zero-extent shapes don't map.
export const buildPreviewModel = (
  shapes: PreviewShapeDescriptor[],
  prefixMatchers: PrefixMatcher[],
): PreviewModel => {
  const boxes: PreviewBox[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of shapes) {
    if (s.type === "arrow" || s.type === "group") continue;
    if (!s.bounds || !s.bounds.w || !s.bounds.h) continue;
    const { x, y, w, h } = s.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);

    const base = { id: s.id, x, y, w, h, img: s.imageUrl };
    if (s.type === "discourse-node" && s.nodeTypeId) {
      // The node's own title carries its format prefix ("[[EVD]] - …"); strip
      // it — the label already shows the type code, and the pixels are better
      // spent on the content (and the key image).
      const raw = s.text ?? "";
      const matcher = prefixMatchers.find((m) => m.regex.test(raw));
      boxes.push({
        ...base,
        kind: "node",
        z: Z.node,
        nodeType: s.nodeTypeId,
        title: collapse(matcher ? raw.replace(matcher.regex, "") : raw),
      });
    } else if (s.type === SUBPAGE_SHAPE_TYPE) {
      boxes.push({
        ...base,
        kind: "portal",
        z: Z.portal,
        color: s.portalAccent,
        title: s.portalTitle ?? "Sub-canvas",
      });
    } else if (s.type === "frame") {
      boxes.push({
        ...base,
        kind: "frame",
        z: Z.frame,
        title: s.frameName ?? "Frame",
      });
    } else if (s.type === "image") {
      boxes.push({ ...base, kind: "image", z: Z.image });
    } else if (s.type === "text") {
      boxes.push({
        ...base,
        kind: "text",
        z: Z.text,
        title: collapse(s.text ?? ""),
      });
    } else {
      const text = s.text ?? "";
      const matcher = prefixMatchers.find((m) => m.regex.test(text));
      if (matcher) {
        boxes.push({
          ...base,
          kind: "node",
          z: Z.node,
          nodeType: matcher.nodeType,
          code: matcher.prefix,
          title: collapse(text.replace(matcher.regex, "")),
        });
      } else {
        boxes.push({
          ...base,
          kind: "geo",
          z: Z.geo,
          colorStyle: s.colorStyle,
          title: collapse(text),
        });
      }
    }
  }

  if (boxes.length === 0) return { count: 0, boxes: [], bounds: null };
  boxes.sort((a, b) => a.z - b.z);
  // count = boxes actually drawn, so the header count agrees with the map (a
  // page holding only arrows shows 0 and an "empty page" body).
  return { count: boxes.length, boxes, bounds: { minX, minY, maxX, maxY } };
};

export type PreviewLayout = {
  area: { x: number; y: number; w: number; h: number };
  scale: number;
  offX: number;
  offY: number;
  subH: number;
};

// Scale-to-fit projection of the page bounds into the portal body (the shape
// minus header, optional subtitle strip, and padding), aspect-preserving,
// centered. Only call with a non-empty model's bounds.
export const layoutPreview = ({
  shape,
  hasSubtitle,
  bounds,
}: {
  shape: { w: number; h: number };
  hasSubtitle: boolean;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}): PreviewLayout => {
  const subH = hasSubtitle ? SUBPAGE_SUBTITLE_HEIGHT : 0;
  const pad = SUBPAGE_BODY_PADDING;
  const area = {
    x: pad,
    y: SUBPAGE_HEADER_HEIGHT + subH + pad,
    w: shape.w - pad * 2,
    h: shape.h - SUBPAGE_HEADER_HEIGHT - subH - pad * 2,
  };
  const pw = Math.max(1, bounds.maxX - bounds.minX);
  const ph = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(area.w / pw, area.h / ph);
  return {
    area,
    scale,
    offX: area.x + (area.w - pw * scale) / 2,
    offY: area.y + (area.h - ph * scale) / 2,
    subH,
  };
};

export type BoxLabel = {
  mode: "title" | "code" | "text";
  text: string;
  fontSize: number;
  /** Line clamp for title mode; 2 when the box has an image so it stays visible. */
  maxLines?: number;
};

export const MAX_LABEL_CHARS = 90;

// Shared by the live (HTML) and export (SVG) renderers so their label
// decisions cannot drift. `bw`/`bh` are the scaled box dimensions.
export const getBoxLabel = (
  box: Pick<PreviewBox, "kind" | "title" | "code" | "img">,
  bw: number,
  bh: number,
): BoxLabel | null => {
  if (box.kind === "text") {
    if (!box.title || bw <= CODE_MIN_W) return null;
    return {
      mode: "text",
      text: box.title,
      fontSize: Math.max(7, Math.min(13, bh * 0.9)),
    };
  }
  if (box.title && bw > TITLE_MIN_W && bh > TITLE_MIN_H) {
    const fontSize = Math.max(6.5, Math.min(11, bh * 0.32));
    const full = (box.code ? `${box.code}  ` : "") + box.title;
    const text =
      full.length > MAX_LABEL_CHARS
        ? `${full.slice(0, MAX_LABEL_CHARS - 1)}…`
        : full;
    const fit = Math.max(1, Math.floor(bh / (fontSize * 1.3)));
    return {
      mode: "title",
      text,
      fontSize,
      maxLines: box.img ? Math.min(2, fit) : fit,
    };
  }
  if (box.code && bw > CODE_MIN_W && bh > CODE_MIN_H) {
    return {
      mode: "code",
      text: box.code,
      fontSize: Math.max(6, Math.min(9, bh * 0.5)),
    };
  }
  return null;
};

// tldraw's createPage silently no-ops at the cap, which would strand an orphan
// portal pointing at a page that never got created — so guard loudly first.
export const assertCanCreateSubpage = ({
  pageCount,
  maxPages,
}: {
  pageCount: number;
  maxPages: number;
}): void => {
  if (pageCount >= maxPages) {
    throw new Error(
      `Cannot create a sub-page: this canvas already has the maximum of ${maxPages} pages. Delete unused pages first.`,
    );
  }
};
