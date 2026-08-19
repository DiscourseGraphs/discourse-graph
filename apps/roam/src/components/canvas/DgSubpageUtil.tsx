// dg-subpage — a portal into another tldraw page. Looks like a framed
// sub-canvas: a colored title bar (click = enter the target page) over a live
// spatial preview of the target page — one scaled box per shape in its true
// position, discourse-type colors, images in place. The preview is a live read
// (never cached): it stores nothing and costs O(shapes on the target page) per
// render.
//
// Ported from the tldraw-offline prototype; see
// dg-prototypes/nested-pages/SPEC.md (§4 shape contract, §5 preview spec).
import {
  BaseBoxShapeUtil,
  createMigrationSequence,
  FileHelpers,
  HTMLContainer,
  T,
  TLAssetId,
  TLBaseShape,
  TLPageId,
  toDomPrecision,
  useValue,
} from "tldraw";
import React from "react";
import { discourseContext } from "./Tldraw";
import { COLOR_PALETTE } from "./DiscourseNodeUtil";
import { getDiscourseNodeColors } from "~/utils/getDiscourseNodeColors";
import {
  buildPreviewModel,
  buildPrefixMatchers,
  getBoxLabel,
  layoutPreview,
  PrefixMatcher,
  PreviewBox,
  PreviewShapeDescriptor,
  SUBPAGE_HEADER_HEIGHT,
  SUBPAGE_SHAPE_TYPE,
} from "~/utils/nestedPages";
import { DEFAULT_PORTAL_ACCENT, enterPage } from "./nestedPageNavigation";

export type DgSubpageShape = TLBaseShape<
  typeof SUBPAGE_SHAPE_TYPE,
  {
    w: number;
    h: number;
    title: string;
    subtitle: string;
    targetPageId: string;
    accent: string;
  }
>;

// Registered from day one (alongside the arrow migrations in
// useCanvasStoreAdapterArgs) so that adding a prop later has a migration home
// instead of turning every persisted board into a validation crash on open.
export const dgSubpageMigrations = createMigrationSequence({
  sequenceId: "com.roam-research.discourse-graphs.dg-subpage",
  retroactive: false,
  sequence: [],
});

// Tier-2 classification derives its prefix alternation from the live grammar's
// node formats — never a hardcoded code list. Cached per nodes object (the
// discourseContext.nodes record is replaced wholesale when settings load).
const matcherCache = new WeakMap<object, PrefixMatcher[]>();
const getPrefixMatchers = (): PrefixMatcher[] => {
  const nodes = discourseContext.nodes;
  let matchers = matcherCache.get(nodes);
  if (!matchers) {
    matchers = buildPrefixMatchers(Object.values(nodes));
    matcherCache.set(nodes, matchers);
  }
  return matchers;
};

const codeForNodeType = (nodeType?: string): string | undefined =>
  nodeType
    ? getPrefixMatchers().find((m) => m.nodeType === nodeType)?.prefix
    : undefined;

const tint = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(150,150,150,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

type BoxPaint = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashed?: boolean;
  labelColor: string;
  labelWeight: number;
};

// One paint table shared by the live (HTML) and export (SVG) renderers so the
// two pictures cannot drift. Discourse nodes use the host's own node colors —
// the same background the real node renders with on the target page.
const paintBox = (box: PreviewBox): BoxPaint => {
  switch (box.kind) {
    case "frame":
      return {
        fill: "transparent",
        stroke: "#b6bcc2",
        strokeWidth: 1,
        dashed: true,
        labelColor: "#6b7178",
        labelWeight: 400,
      };
    case "image":
      return {
        fill: "#eef2f7",
        stroke: "#cfd8e6",
        strokeWidth: 1,
        labelColor: "#2b2f33",
        labelWeight: 400,
      };
    case "node": {
      const { backgroundColor, textColor } = getDiscourseNodeColors({
        nodeType: box.nodeType,
        discourseNodes: Object.values(discourseContext.nodes),
      });
      return {
        fill: backgroundColor,
        stroke: "rgba(0,0,0,0.12)",
        strokeWidth: 1,
        labelColor: textColor,
        labelWeight: 600,
      };
    }
    case "portal": {
      const accent = box.color ?? DEFAULT_PORTAL_ACCENT;
      return {
        fill: tint(accent, 0.1),
        stroke: accent,
        strokeWidth: 1.5,
        labelColor: "#2b2f33",
        labelWeight: 600,
      };
    }
    case "text":
      return {
        fill: "transparent",
        stroke: "none",
        strokeWidth: 0,
        labelColor: "#495057",
        labelWeight: 500,
      };
    default: {
      const hex = COLOR_PALETTE[box.colorStyle ?? ""] ?? "#adb5bd";
      return {
        fill: tint(hex, 0.15),
        stroke: tint(hex, 0.55),
        strokeWidth: 1,
        labelColor: "#2b2f33",
        labelWeight: 400,
      };
    }
  }
};

const trunc = (s: string, px: number, fontSize: number): string => {
  const max = Math.max(3, Math.floor(px / (fontSize * 0.55)));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export class DgSubpageUtil extends BaseBoxShapeUtil<DgSubpageShape> {
  static override type = SUBPAGE_SHAPE_TYPE;

  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    subtitle: T.string,
    targetPageId: T.string,
    accent: T.string,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  // Load-bearing: arrows must stay bindable to portals (a frame converted into
  // a portal keeps its bound relations).
  override canBind = () => true;
  override canEdit = () => false;

  getDefaultProps(): DgSubpageShape["props"] {
    return {
      w: 460,
      h: 340,
      title: "Sub-canvas",
      subtitle: "",
      targetPageId: "",
      accent: DEFAULT_PORTAL_ACCENT,
    };
  }

  // One descriptor per shape on the target page, in page coordinates (via
  // getShapePageBounds so auto-sized text shapes get their rendered height).
  // Returns null exactly when the target page is missing.
  readTargetPageDescriptors(
    targetPageId: string,
  ): PreviewShapeDescriptor[] | null {
    const editor = this.editor;
    const pageId = targetPageId as TLPageId;
    if (!targetPageId || !editor.getPage(pageId)) return null;
    const descriptors: PreviewShapeDescriptor[] = [];
    for (const id of editor.getPageShapeIds(pageId)) {
      const shape = editor.getShape(id);
      if (!shape) continue;
      const pageBounds = editor.getShapePageBounds(id);
      const props = shape.props as {
        title?: unknown;
        text?: unknown;
        name?: unknown;
        nodeTypeId?: unknown;
        imageUrl?: unknown;
        assetId?: unknown;
        color?: unknown;
        accent?: unknown;
        targetPageId?: unknown;
      };
      // Tier 1 covers both the modern discourse-node shape and legacy per-type
      // node shapes (whose type is itself a node type id).
      const nodeTypeId =
        typeof props.nodeTypeId === "string" && props.nodeTypeId
          ? props.nodeTypeId
          : discourseContext.nodes[shape.type]
            ? shape.type
            : undefined;
      const assetSrc =
        shape.type === "image" && typeof props.assetId === "string"
          ? (this.editor.getAsset(props.assetId as TLAssetId)?.props.src ??
            undefined)
          : undefined;
      descriptors.push({
        id: shape.id,
        type: nodeTypeId ? "discourse-node" : shape.type,
        bounds: pageBounds
          ? {
              x: pageBounds.x,
              y: pageBounds.y,
              w: pageBounds.w,
              h: pageBounds.h,
            }
          : null,
        text:
          typeof props.title === "string"
            ? props.title
            : typeof props.text === "string"
              ? props.text
              : undefined,
        nodeTypeId,
        imageUrl:
          typeof props.imageUrl === "string" ? props.imageUrl : assetSrc,
        // Nested portals preview under their live target-page name, matching
        // the live header (stored title is only the missing-page fallback).
        portalTitle:
          (typeof props.targetPageId === "string" &&
            editor.getPage(props.targetPageId as TLPageId)?.name) ||
          (typeof props.title === "string" ? props.title : undefined),
        portalAccent:
          typeof props.accent === "string" ? props.accent : undefined,
        frameName: typeof props.name === "string" ? props.name : undefined,
        colorStyle: typeof props.color === "string" ? props.color : undefined,
      });
    }
    return descriptors;
  }

  readPreviewModel(targetPageId: string) {
    const descriptors = this.readTargetPageDescriptors(targetPageId);
    if (!descriptors) return null;
    return buildPreviewModel(descriptors, getPrefixMatchers());
  }

  component(shape: DgSubpageShape) {
    const { w, h, title, subtitle, targetPageId, accent } = shape.props;
    // Reactive live read: recomputes when the target page's shapes change.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const model = useValue(
      `dg-subpage-preview-${shape.id}`,
      () => this.readPreviewModel(targetPageId),
      [targetPageId],
    );
    // The header shows the live page name, so renaming the target page is
    // reflected immediately; props.title is only the missing-page fallback.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const livePageName = useValue(
      `dg-subpage-title-${shape.id}`,
      () => this.editor.getPage(targetPageId as TLPageId)?.name ?? null,
      [targetPageId],
    );
    const headerTitle = livePageName ?? title;

    const boxes: JSX.Element[] = [];
    if (model?.bounds) {
      const layout = layoutPreview({
        shape: { w, h },
        hasSubtitle: !!subtitle,
        bounds: model.bounds,
      });
      model.boxes.forEach((box, i) => {
        const bw = Math.max(2, box.w * layout.scale);
        const bh = Math.max(2, box.h * layout.scale);
        const left =
          layout.offX +
          (box.x - model.bounds!.minX) * layout.scale -
          layout.area.x;
        const top =
          layout.offY +
          (box.y - model.bounds!.minY) * layout.scale -
          (SUBPAGE_HEADER_HEIGHT + layout.subH);
        const paint = paintBox(box);
        const label = getBoxLabel(
          { ...box, code: box.code ?? codeForNodeType(box.nodeType) },
          bw,
          bh,
        );
        const style: React.CSSProperties = {
          position: "absolute",
          left,
          top,
          width: bw,
          height: bh,
          borderRadius: Math.min(4, bh / 4),
          boxSizing: "border-box",
          overflow: box.kind === "text" ? "visible" : "hidden",
          background: paint.fill,
          border:
            paint.stroke === "none"
              ? "none"
              : `${paint.strokeWidth}px ${paint.dashed ? "dashed" : "solid"} ${paint.stroke}`,
        };
        boxes.push(
          <div key={box.id ?? i} style={style}>
            {box.img ? (
              <img
                src={box.img}
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : null}
            {label?.mode === "text" ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: bw,
                  fontSize: label.fontSize,
                  lineHeight: 1.05,
                  color: paint.labelColor,
                  fontWeight: paint.labelWeight,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label.text}
              </div>
            ) : label?.mode === "title" ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  // Image boxes keep the full image visible and overlay a
                  // short label strip at the bottom (maxLines is 2 there).
                  bottom: box.img ? 0 : "auto",
                  top: box.img ? "auto" : 0,
                  padding: "1px 3px",
                  fontSize: label.fontSize,
                  lineHeight: 1.15,
                  fontWeight: paint.labelWeight,
                  color: paint.labelColor,
                  display: "-webkit-box",
                  WebkitLineClamp: label.maxLines ?? 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  background: box.img ? "rgba(255,255,255,.82)" : "transparent",
                }}
              >
                {label.text}
              </div>
            ) : label?.mode === "code" ? (
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  left: 2,
                  fontSize: label.fontSize,
                  fontWeight: 700,
                  color: paint.labelColor,
                }}
              >
                {label.text}
              </div>
            ) : null}
          </div>,
        );
      });
    }

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 10,
          background: "#ffffff",
          border: `1.5px solid ${accent}`,
          boxShadow: "0 2px 10px rgba(20,20,40,0.10)",
          // The body stays pointer-transparent so the shape still selects,
          // drags, and resizes through tldraw's canvas hit-testing; only the
          // header opts back into DOM events.
          pointerEvents: "none",
          fontFamily: "var(--tl-font-sans, Inter, system-ui, sans-serif)",
        }}
      >
        <div
          title="Open sub-canvas"
          // The title bar is the enter target, as a DOM pointer handler:
          // navigation must never depend on tldraw selection state (a selected
          // shape would otherwise eat the first click).
          onPointerDown={(e) => {
            e.stopPropagation();
            enterPage(this.editor, targetPageId);
          }}
          style={{
            flex: "0 0 auto",
            height: SUBPAGE_HEADER_HEIGHT,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            background: accent,
            color: "#fff",
            cursor: "pointer",
            pointerEvents: "all",
            userSelect: "none",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {headerTitle}
          </span>
          <span style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap" }}>
            {model?.count ?? 0} items
          </span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>↗</span>
        </div>
        {subtitle ? (
          <div
            style={{
              flex: "0 0 auto",
              padding: "4px 10px 0",
              fontSize: 11,
              color: "#70757a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div
          style={{
            position: "relative",
            flex: 1,
            overflow: "hidden",
            margin: "0 8px 8px",
            background: "#fcfcfd",
            borderRadius: 6,
          }}
        >
          {!model ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9aa0a6",
                fontSize: 13,
              }}
            >
              target page not found
            </div>
          ) : model.boxes.length === 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9aa0a6",
                fontSize: 13,
              }}
            >
              empty page
            </div>
          ) : (
            boxes
          )}
        </div>
      </HTMLContainer>
    );
  }

  // Export renderer. Shares the classifier (readPreviewModel), projection
  // (layoutPreview), paint table (paintBox), and label thresholds (getBoxLabel)
  // with component() — SPEC §5 export parity.
  async toSvg(shape: DgSubpageShape): Promise<JSX.Element> {
    const { w, h, title, subtitle, targetPageId, accent } = shape.props;
    const model = this.readPreviewModel(targetPageId);
    // Same live-name rule as component(): props.title only when the page is gone.
    const headerTitle =
      this.editor.getPage(targetPageId as TLPageId)?.name ?? title;
    const clipId = `dgm-${shape.id.replace(/[^a-zA-Z0-9]/g, "")}-h`;

    const children: JSX.Element[] = [];
    if (model?.bounds) {
      const layout = layoutPreview({
        shape: { w, h },
        hasSubtitle: !!subtitle,
        bounds: model.bounds,
      });
      const images = await Promise.all(
        model.boxes.map(async (box) => {
          if (!box.img) return null;
          try {
            const response = await fetch(box.img);
            const blob = await response.blob();
            return await FileHelpers.blobToDataUrl(blob);
          } catch {
            return null;
          }
        }),
      );
      model.boxes.forEach((box, i) => {
        const bw = Math.max(2, box.w * layout.scale);
        const bh = Math.max(2, box.h * layout.scale);
        const x = layout.offX + (box.x - model.bounds!.minX) * layout.scale;
        const y = layout.offY + (box.y - model.bounds!.minY) * layout.scale;
        const paint = paintBox(box);
        const label = getBoxLabel(
          { ...box, code: box.code ?? codeForNodeType(box.nodeType) },
          bw,
          bh,
        );
        if (box.kind !== "text") {
          children.push(
            <rect
              key={`b${i}`}
              x={x}
              y={y}
              width={bw}
              height={bh}
              rx={2}
              fill={paint.fill}
              stroke={paint.stroke === "none" ? undefined : paint.stroke}
              strokeWidth={paint.strokeWidth}
              strokeDasharray={paint.dashed ? "3 2" : undefined}
            />,
          );
        }
        const img = images[i];
        if (img && bw > 8 && bh > 8) {
          children.push(
            <image
              key={`i${i}`}
              xlinkHref={img}
              x={x}
              y={y}
              width={bw}
              height={bh}
              preserveAspectRatio="xMidYMid slice"
            />,
          );
        }
        if (label) {
          // Image boxes keep the full image and put the label at the bottom,
          // same as the live render.
          const textY =
            label.mode === "text"
              ? y + label.fontSize
              : img
                ? y + bh - 3
                : y + label.fontSize + 2;
          if (img && label.mode === "title") {
            children.push(
              <rect
                key={`ls${i}`}
                x={x}
                y={y + bh - label.fontSize - 5}
                width={bw}
                height={label.fontSize + 5}
                fill="rgba(255,255,255,.82)"
              />,
            );
          }
          children.push(
            <text
              key={`t${i}`}
              x={label.mode === "code" ? x + 2 : x + 3}
              y={textY}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={label.fontSize}
              fill={paint.labelColor}
              fontWeight={label.mode === "code" ? 700 : paint.labelWeight}
            >
              {trunc(label.text, bw - 6, label.fontSize)}
            </text>,
          );
        }
      });
    }

    return (
      <g>
        <rect
          width={w}
          height={h}
          rx={10}
          fill="#ffffff"
          stroke={accent}
          strokeWidth={1.5}
        />
        <clipPath id={clipId}>
          <rect width={w} height={SUBPAGE_HEADER_HEIGHT} />
        </clipPath>
        <rect
          width={w}
          height={SUBPAGE_HEADER_HEIGHT}
          rx={10}
          fill={accent}
          clipPath={`url(#${clipId})`}
        />
        <text
          x={10}
          y={25}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={14}
          fill="#ffffff"
          fontWeight={600}
        >
          {trunc(headerTitle, w - 90, 14)}
        </text>
        <text
          x={w - 18}
          y={25}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={15}
          fill="#ffffff"
          fontWeight={700}
        >
          ↗
        </text>
        {subtitle ? (
          <text
            x={10}
            y={SUBPAGE_HEADER_HEIGHT + 14}
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={11}
            fill="#70757a"
          >
            {trunc(subtitle, w - 20, 11)}
          </text>
        ) : null}
        {!model ? (
          <text
            x={w / 2}
            y={h / 2}
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={13}
            fill="#9aa0a6"
          >
            target page not found
          </text>
        ) : null}
        {children}
      </g>
    );
  }

  indicator(shape: DgSubpageShape) {
    return (
      <rect
        width={toDomPrecision(shape.props.w)}
        height={toDomPrecision(shape.props.h)}
        rx={10}
      />
    );
  }
}
