/* Note: All the functions are a copied and modified from arrow functions of tldraw 3.14.2
https://github.com/tldraw/tldraw/tree/main/packages/tldraw/src/lib/shapes/arrow
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable preferArrows/prefer-arrow-functions */
/* eslint-disable @typescript-eslint/naming-convention */

import React, { useRef, useEffect, useState } from "react";
import {
  createComputedCache,
  Editor,
  TLShapeId,
  Vec,
  Group2d,
  MatModel,
  Mat,
  intersectLineSegmentPolygon,
  intersectLineSegmentPolyline,
  VecLike,
  useEditor,
  useSvgExportContext,
  useValue,
  TLDefaultColorTheme,
  intersectCircleCircle,
  PI,
  HALF_PI,
  Edge2d,
  Arc2d,
  TEXT_PROPS,
  FONT_FAMILIES,
  Box,
  Geometry2d,
  clamp,
  getPointOnCircle,
  Polygon2d,
  Circle2d,
  angleDistance,
  intersectCirclePolygon,
  TLDefaultFillStyle,
  SvgExportDef,
  DefaultFontStyle,
  TLDefaultFontStyle,
  TLDefaultHorizontalAlignStyle,
  TLDefaultVerticalAlignStyle,
  useDefaultColorTheme,
  DefaultFontFamilies,
  BoxModel,
  FileHelpers,
  TLShapeUtilCanvasSvgDef,
  DefaultColorThemePalette,
  track,
  getPerfectDashProps,
  toDomPrecision,
  TLShape,
  TLArrowBindingProps,
  TLShapePartial,
  TLDefaultSizeStyle,
  PI2,
  TLArcInfo,
} from "tldraw";
import type {
  RelationBindings,
  RelationBinding,
  RelationInfo,
} from "~/components/canvas/shapes/DiscourseRelationBinding";
import {
  DiscourseRelationShape,
  DiscourseRelationUtil,
} from "~/components/canvas/shapes/DiscourseRelationShape";
import DiscourseGraphPlugin from "~/index";

let defaultPixels: { white: string; black: string } | null = null;
let globalRenderIndex = 0;
const WAY_TOO_BIG_ARROW_BEND_FACTOR = 10;
const MIN_ARROW_BEND = 8;
const MIN_ARROW_LENGTH = 10;
const BOUND_ARROW_OFFSET = 10;
const labelSizeCache = new WeakMap<DiscourseRelationShape, Vec>();
const LABEL_TO_ARROW_PADDING = 20;
const ARROW_LABEL_PADDING = 4.25;
const ARROW_LABEL_FONT_SIZES: Record<TLDefaultSizeStyle, number> = {
  s: 18,
  m: 20,
  l: 24,
  xl: 28,
};
const TILE_PATTERN_SIZE = 8;
export const STROKE_SIZES: Record<TLDefaultSizeStyle, number> = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 10,
};
export enum ARROW_HANDLES {
  START = "start",
  MIDDLE = "middle",
  END = "end",
}
interface ShapeFillProps {
  d: string;
  fill: TLDefaultFillStyle;
  color: string;
  theme?: TLDefaultColorTheme;
  scale: number;
}
interface PatternDef {
  zoom: number;
  url: string;
  theme: "light" | "dark";
}
interface BoundShapeInfo<T extends TLShape = TLShape> {
  shape: T;
  didIntersect: boolean;
  isExact: boolean;
  isClosed: boolean;
  transform: Mat;
  outline: Vec[];
}
const arrowInfoCache = createComputedCache(
  "relation info",
  (editor: Editor, shape: DiscourseRelationShape) => {
    const bindings = getArrowBindings(editor, shape);
    return getIsArrowStraight(shape)
      ? getStraightArrowInfo(editor, shape, bindings)
      : getCurvedArrowInfo(editor, shape, bindings);
  },
);
export function getArrowInfo(
  editor: Editor,
  shape: DiscourseRelationShape | TLShapeId,
) {
  const id = typeof shape === "string" ? shape : shape.id;
  return arrowInfoCache.get(editor, id);
}
export function getArrowBindings(
  editor: Editor,
  relation: DiscourseRelationShape,
): RelationBindings {
  const bindings = editor.getBindingsFromShape<RelationBinding>(
    relation,
    relation.type, // we expect relation.type to = binding.type
  );
  return {
    start: bindings.find((b) => b.props.terminal === "start"),
    end: bindings.find((b) => b.props.terminal === "end"),
  };
}
function getStraightArrowInfo(
  editor: Editor,
  relation: DiscourseRelationShape,
  bindings: RelationBindings,
): RelationInfo {
  const { arrowheadStart, arrowheadEnd } = relation.props;

  const terminalsInArrowSpace = getArrowTerminalsInArrowSpace(
    editor,
    relation,
    bindings,
  );

  const a = terminalsInArrowSpace.start.clone();
  const b = terminalsInArrowSpace.end.clone();
  const c = Vec.Med(a, b);

  if (Vec.Equals(a, b)) {
    return {
      bindings,
      isStraight: true,
      start: {
        handle: a,
        point: a,
        arrowhead: relation.props.arrowheadStart,
      },
      end: {
        handle: b,
        point: b,
        arrowhead: relation.props.arrowheadEnd,
      },
      middle: c,
      isValid: false,
      length: 0,
    };
  }

  const uAB = Vec.Sub(b, a).uni();

  // Update the arrowhead points using intersections with the bound shapes, if any.

  const startShapeInfo = getBoundShapeInfoForTerminal(
    editor,
    relation,
    "start",
  );
  const endShapeInfo = getBoundShapeInfoForTerminal(editor, relation, "end");

  const arrowPageTransform = editor.getShapePageTransform(relation)!;

  // Update the position of the arrowhead's end point
  updateArrowheadPointWithBoundShape(
    b, // <-- will be mutated
    terminalsInArrowSpace.start,
    arrowPageTransform,
    endShapeInfo,
  );

  // Then update the position of the arrowhead's end point
  updateArrowheadPointWithBoundShape(
    a, // <-- will be mutated
    terminalsInArrowSpace.end,
    arrowPageTransform,
    startShapeInfo,
  );

  let offsetA = 0;
  let offsetB = 0;
  let strokeOffsetA = 0;
  let strokeOffsetB = 0;
  let minLength = MIN_ARROW_LENGTH * relation.props.scale;

  const isSelfIntersection =
    startShapeInfo &&
    endShapeInfo &&
    startShapeInfo.shape === endShapeInfo.shape;

  const relationship =
    startShapeInfo && endShapeInfo
      ? getBoundShapeRelationships(
          editor,
          startShapeInfo.shape.id,
          endShapeInfo.shape.id,
        )
      : "safe";

  if (
    relationship === "safe" &&
    startShapeInfo &&
    endShapeInfo &&
    !isSelfIntersection &&
    !startShapeInfo.isExact &&
    !endShapeInfo.isExact
  ) {
    if (endShapeInfo.didIntersect && !startShapeInfo.didIntersect) {
      // ...and if only the end shape intersected, then make it
      // a short arrow ending at the end shape intersection.

      if (startShapeInfo.isClosed) {
        a.setTo(
          b
            .clone()
            .add(uAB.clone().mul(MIN_ARROW_LENGTH * relation.props.scale)),
        );
      }
    } else if (!endShapeInfo.didIntersect) {
      // ...and if only the end shape intersected, or if neither
      // shape intersected, then make it a short arrow starting
      // at the start shape intersection.
      if (endShapeInfo.isClosed) {
        b.setTo(
          a
            .clone()
            .sub(uAB.clone().mul(MIN_ARROW_LENGTH * relation.props.scale)),
        );
      }
    }
  }

  const distance = Vec.Sub(b, a);
  // Check for divide-by-zero before we call uni()
  const u = Vec.Len(distance) ? distance.uni() : Vec.From(distance);
  const didFlip = !Vec.Equals(u, uAB);

  // If the arrow is bound non-exact to a start shape and the
  // start point has an arrowhead, then offset the start point
  if (!isSelfIntersection) {
    if (
      relationship !== "start-contains-end" &&
      startShapeInfo &&
      arrowheadStart !== "none" &&
      !startShapeInfo.isExact
    ) {
      strokeOffsetA =
        STROKE_SIZES[relation.props.size] / 2 +
        ("size" in startShapeInfo.shape.props
          ? STROKE_SIZES[startShapeInfo.shape.props.size] / 2
          : 0);
      offsetA = (BOUND_ARROW_OFFSET + strokeOffsetA) * relation.props.scale;
      minLength += strokeOffsetA * relation.props.scale;
    }

    // If the arrow is bound non-exact to an end shape and the
    // end point has an arrowhead offset the end point
    if (
      relationship !== "end-contains-start" &&
      endShapeInfo &&
      arrowheadEnd !== "none" &&
      !endShapeInfo.isExact
    ) {
      strokeOffsetB =
        STROKE_SIZES[relation.props.size] / 2 +
        ("size" in endShapeInfo.shape.props
          ? STROKE_SIZES[endShapeInfo.shape.props.size] / 2
          : 0);
      offsetB = (BOUND_ARROW_OFFSET + strokeOffsetB) * relation.props.scale;
      minLength += strokeOffsetB * relation.props.scale;
    }
  }

  // Adjust offsets if the length of the arrow is too small

  const tA = a.clone().add(u.clone().mul(offsetA * (didFlip ? -1 : 1)));
  const tB = b.clone().sub(u.clone().mul(offsetB * (didFlip ? -1 : 1)));

  if (Vec.DistMin(tA, tB, minLength)) {
    if (offsetA !== 0 && offsetB !== 0) {
      // both bound + offset
      offsetA *= -1.5;
      offsetB *= -1.5;
    } else if (offsetA !== 0) {
      // start bound + offset
      offsetA *= -1;
    } else if (offsetB !== 0) {
      // end bound + offset
      offsetB *= -1;
    } else {
      // noop, its just a really short arrow
    }
  }

  a.add(u.clone().mul(offsetA * (didFlip ? -1 : 1)));
  b.sub(u.clone().mul(offsetB * (didFlip ? -1 : 1)));

  // If the handles flipped their order, then set the center handle
  // to the midpoint of the terminals (rather than the midpoint of the
  // arrow body); otherwise, it may not be "between" the other terminals.
  if (didFlip) {
    if (startShapeInfo && endShapeInfo) {
      // If we have two bound shapes...then make the arrow a short arrow from
      // the start point towards where the end point should be.
      b.setTo(
        Vec.Add(a, u.clone().mul(-MIN_ARROW_LENGTH * relation.props.scale)),
      );
    }
    c.setTo(Vec.Med(terminalsInArrowSpace.start, terminalsInArrowSpace.end));
  } else {
    c.setTo(Vec.Med(a, b));
  }

  const length = Vec.Dist(a, b);

  return {
    bindings,
    isStraight: true,
    start: {
      handle: terminalsInArrowSpace.start,
      point: a,
      arrowhead: relation.props.arrowheadStart,
    },
    end: {
      handle: terminalsInArrowSpace.end,
      point: b,
      arrowhead: relation.props.arrowheadEnd,
    },
    middle: c,
    isValid: length > 0,
    length,
  };
}
function getBoundShapeInfoForTerminal(
  editor: Editor,
  relation: DiscourseRelationShape,
  terminalName: "start" | "end",
): BoundShapeInfo | undefined {
  const binding = editor
    .getBindingsFromShape<RelationBinding>(relation, relation.type) // we expect relation.type to = binding.type
    .find((b) => b.props.terminal === terminalName);
  if (!binding) return;

  const boundShape = editor.getShape(binding.toId)!;
  if (!boundShape) return;
  const transform = editor.getShapePageTransform(boundShape)!;
  const geometry = editor.getShapeGeometry(boundShape);

  // This is hacky: we're only looking at the first child in the group. Really the arrow should
  // consider all items in the group which are marked as snappable as separate polygons with which
  // to intersect, in the case of a group that has multiple children which do not overlap; or else
  // flatten the geometry into a set of polygons and intersect with that.
  const outline =
    geometry instanceof Group2d
      ? (geometry.children[0]?.vertices ?? [])
      : geometry.vertices;

  return {
    shape: boundShape,
    transform,
    isClosed: geometry.isClosed,
    isExact: binding.props.isExact,
    didIntersect: false,
    outline,
  };
}
export function getArrowTerminalsInArrowSpace(
  editor: Editor,
  shape: DiscourseRelationShape,
  bindings: RelationBindings,
) {
  const arrowPageTransform = editor.getShapePageTransform(shape)!;

  const boundShapeRelationships = getBoundShapeRelationships(
    editor,
    bindings.start?.toId,
    bindings.end?.toId,
  );

  const start = bindings.start
    ? getArrowTerminalInArrowSpace(
        editor,
        arrowPageTransform,
        bindings.start,
        boundShapeRelationships === "double-bound" ||
          boundShapeRelationships === "start-contains-end",
      )
    : Vec.From(shape.props.start);

  const end = bindings.end
    ? getArrowTerminalInArrowSpace(
        editor,
        arrowPageTransform,
        bindings.end,
        boundShapeRelationships === "double-bound" ||
          boundShapeRelationships === "end-contains-start",
      )
    : Vec.From(shape.props.end);

  return { start, end };
}
function updateArrowheadPointWithBoundShape(
  point: Vec,
  opposite: Vec,
  arrowPageTransform: MatModel,
  targetShapeInfo?: BoundShapeInfo,
) {
  if (targetShapeInfo === undefined) {
    // No bound shape? The arrowhead point will be at the arrow terminal.
    return;
  }

  if (targetShapeInfo.isExact) {
    // Exact type binding? The arrowhead point will be at the arrow terminal.
    return;
  }

  // From and To in page space
  const pageFrom = Mat.applyToPoint(arrowPageTransform, opposite);
  const pageTo = Mat.applyToPoint(arrowPageTransform, point);

  // From and To in local space of the target shape
  const targetFrom = Mat.applyToPoint(
    Mat.Inverse(targetShapeInfo.transform),
    pageFrom,
  );
  const targetTo = Mat.applyToPoint(
    Mat.Inverse(targetShapeInfo.transform),
    pageTo,
  );

  const isClosed = targetShapeInfo.isClosed;
  const fn = isClosed
    ? intersectLineSegmentPolygon
    : intersectLineSegmentPolyline;

  const intersection = fn(targetFrom, targetTo, targetShapeInfo.outline);

  let targetInt: VecLike | undefined;

  if (intersection !== null) {
    targetInt =
      intersection.sort(
        (p1, p2) => Vec.Dist2(p1, targetFrom) - Vec.Dist2(p2, targetFrom),
      )[0] ?? (isClosed ? undefined : targetTo);
  }

  if (targetInt === undefined) {
    // No intersection? The arrowhead point will be at the arrow terminal.
    return;
  }

  const pageInt = Mat.applyToPoint(targetShapeInfo.transform, targetInt);
  const arrowInt = Mat.applyToPoint(Mat.Inverse(arrowPageTransform), pageInt);

  point.setTo(arrowInt);

  targetShapeInfo.didIntersect = true;
}
function getArrowTerminalInArrowSpace(
  editor: Editor,
  arrowPageTransform: Mat,
  binding: RelationBinding,
  forceImprecise: boolean,
) {
  const boundShape = editor.getShape(binding.toId);

  if (!boundShape) {
    // this can happen in multiplayer contexts where the shape is being deleted
    return new Vec(0, 0);
  } else {
    // Find the actual local point of the normalized terminal on
    // the bound shape and transform it to page space, then transform
    // it to arrow space
    const { point, size } = editor.getShapeGeometry(boundShape).bounds;
    const shapePoint = Vec.Add(
      point,
      Vec.MulV(
        // if the parent is the bound shape, then it's ALWAYS precise
        binding.props.isPrecise || forceImprecise
          ? binding.props.normalizedAnchor
          : { x: 0.5, y: 0.5 },
        size,
      ),
    );
    const pagePoint = Mat.applyToPoint(
      editor.getShapePageTransform(boundShape)!,
      shapePoint,
    );
    const arrowPoint = Mat.applyToPoint(
      Mat.Inverse(arrowPageTransform),
      pagePoint,
    );
    return arrowPoint;
  }
}
function getBoundShapeRelationships(
  editor: Editor,
  startShapeId?: TLShapeId,
  endShapeId?: TLShapeId,
) {
  if (!startShapeId || !endShapeId) return "safe";
  if (startShapeId === endShapeId) return "double-bound";
  const startBounds = editor.getShapePageBounds(startShapeId);
  const endBounds = editor.getShapePageBounds(endShapeId);
  if (startBounds && endBounds) {
    if (startBounds.contains(endBounds)) return "start-contains-end";
    if (endBounds.contains(startBounds)) return "end-contains-start";
  }
  return "safe";
}
function PatternFill(props: ShapeFillProps) {
  const { d, color } = props;
  const theme = props.theme ?? useDefaultColorTheme();
  const editor = useEditor();
  const svgExport = useSvgExportContext();
  const zoomLevel = useValue("zoomLevel", () => editor.getZoomLevel(), [
    editor,
  ]);

  const teenyTiny = editor.getZoomLevel() <= 0.18;

  return (
    <>
      <path fill={color} d={d} />
      <path
        fill={
          svgExport
            ? `url(#${getHashPatternZoomName(1, theme.id)})`
            : teenyTiny
              ? color
              : `url(#${getHashPatternZoomName(zoomLevel, theme.id)})`
        }
        d={d}
      />
    </>
  );
}
function getHashPatternZoomName(
  zoom: number,
  theme: TLDefaultColorTheme["id"],
) {
  const lod = getPatternLodForZoomLevel(zoom);
  return `tldraw_hash_pattern_${theme}_${lod}`;
}
function getPatternLodForZoomLevel(zoom: number) {
  return Math.ceil(Math.log2(Math.max(1, zoom)));
}
export function getArrowheadPathForType(
  info: RelationInfo,
  side: "start" | "end",
  strokeWidth: number,
): string | undefined {
  const type = side === "end" ? info.end.arrowhead : info.start.arrowhead;
  if (type === "none") return;

  const points = getArrowPoints(info, side, strokeWidth);
  if (!points) return;

  switch (type) {
    case "bar":
      return getBarHead(points);
    case "square":
      return getSquareHead(points);
    case "diamond":
      return getDiamondHead(points);
    case "dot":
      return getDotHead(points);
    case "inverted":
      return getInvertedTriangleHead(points);
    case "arrow":
      return getArrowhead(points);
    case "triangle":
      return getTriangleHead(points);
  }

  return "";
}
interface RelationArrowPointsInfo {
  point: VecLike;
  int: VecLike;
}
function getArrowPoints(
  info: RelationInfo,
  side: "start" | "end",
  strokeWidth: number,
): RelationArrowPointsInfo {
  const PT = side === "end" ? info.end.point : info.start.point;
  const PB = side === "end" ? info.start.point : info.end.point;

  const compareLength = info.isStraight
    ? Vec.Dist(PB, PT)
    : Math.abs(info.bodyArc.length); // todo: arc length for curved arrows

  const length = Math.max(
    Math.min(compareLength / 5, strokeWidth * 3),
    strokeWidth,
  );

  let P0: VecLike;

  if (info.isStraight) {
    P0 = Vec.Nudge(PT, PB, length);
  } else {
    const ints = intersectCircleCircle(
      PT,
      length,
      info.handleArc.center,
      info.handleArc.radius,
    );
    const [i0, i1] =
      (ints?.length ?? 0) >= 2
        ? (ints as [VecLike, VecLike])
        : [info.start.point, info.start.point];

    P0 =
      side === "end"
        ? info.handleArc.sweepFlag
          ? i0
          : i1
        : info.handleArc.sweepFlag
          ? i1
          : i0;
  }

  if (Vec.IsNaN(P0)) {
    P0 = info.start.point;
  }

  return {
    point: PT,
    int: P0,
  };
}
export function getStraightArrowHandlePath(
  info: RelationInfo & { isStraight: true },
) {
  return getArrowPath(info.start.handle, info.end.handle);
}
function getArrowPath(start: VecLike, end: VecLike) {
  return `M${start.x},${start.y}L${end.x},${end.y}`;
}
export function getSolidStraightArrowPath(
  info: RelationInfo & { isStraight: true },
) {
  return getArrowPath(info.start.point, info.end.point);
}
function getArrowhead({ point, int }: RelationArrowPointsInfo) {
  const PL = Vec.RotWith(int, point, PI / 6);
  const PR = Vec.RotWith(int, point, -PI / 6);

  return `M ${PL.x} ${PL.y} L ${point.x} ${point.y} L ${PR.x} ${PR.y}`;
}
function getTriangleHead({ point, int }: RelationArrowPointsInfo) {
  const PL = Vec.RotWith(int, point, PI / 6);
  const PR = Vec.RotWith(int, point, -PI / 6);

  return `M ${PL.x} ${PL.y} L ${point.x} ${point.y} L ${PR.x} ${PR.y} Z`;
}
function getInvertedTriangleHead({ point, int }: RelationArrowPointsInfo) {
  const d = Vec.Sub(int, point).div(2);
  const PL = Vec.Add(point, Vec.Rot(d, HALF_PI));
  const PR = Vec.Sub(point, Vec.Rot(d, HALF_PI));

  return `M ${PL.x} ${PL.y} L ${int.x} ${int.y} L ${PR.x} ${PR.y} Z`;
}
function getDotHead({ point, int }: RelationArrowPointsInfo) {
  const A = Vec.Lrp(point, int, 0.45);
  const r = Vec.Dist(A, point);

  return `M ${A.x - r},${A.y}
  a ${r},${r} 0 1,0 ${r * 2},0
  a ${r},${r} 0 1,0 -${r * 2},0 `;
}
function getDiamondHead({ point, int }: RelationArrowPointsInfo) {
  const PB = Vec.Lrp(point, int, 0.75);
  const PL = Vec.RotWith(PB, point, PI / 4);
  const PR = Vec.RotWith(PB, point, -PI / 4);

  const PQ = Vec.Lrp(PL, PR, 0.5);
  PQ.add(Vec.Sub(PQ, point));

  return `M ${PQ.x} ${PQ.y} L ${PL.x} ${PL.y} ${point.x} ${point.y} L ${PR.x} ${PR.y} Z`;
}
function getSquareHead({ int, point }: RelationArrowPointsInfo) {
  const PB = Vec.Lrp(point, int, 0.85);
  const d = Vec.Sub(PB, point).div(2);
  const PL1 = Vec.Add(point, Vec.Rot(d, HALF_PI));
  const PR1 = Vec.Sub(point, Vec.Rot(d, HALF_PI));
  const PL2 = Vec.Add(PB, Vec.Rot(d, HALF_PI));
  const PR2 = Vec.Sub(PB, Vec.Rot(d, HALF_PI));

  return `M ${PL1.x} ${PL1.y} L ${PL2.x} ${PL2.y} L ${PR2.x} ${PR2.y} L ${PR1.x} ${PR1.y} Z`;
}
function getBarHead({ int, point }: RelationArrowPointsInfo) {
  const d = Vec.Sub(int, point).div(2);

  const PL = Vec.Add(point, Vec.Rot(d, HALF_PI));
  const PR = Vec.Sub(point, Vec.Rot(d, HALF_PI));

  return `M ${PL.x} ${PL.y} L ${PR.x} ${PR.y}`;
}
function getLength(editor: Editor, shape: DiscourseRelationShape): number {
  const info = getArrowInfo(editor, shape)!;

  return info.isStraight
    ? Vec.Dist(info.start.handle, info.end.handle)
    : Math.abs(info.handleArc.length);
}
function getArrowLabelSize(editor: Editor, shape: DiscourseRelationShape) {
  const cachedSize = labelSizeCache.get(shape);
  if (cachedSize) return cachedSize;

  const info = getArrowInfo(editor, shape)!;
  let width = 0;
  let height = 0;

  const bodyGeom = info.isStraight
    ? new Edge2d({
        start: Vec.From(info.start.point),
        end: Vec.From(info.end.point),
      })
    : new Arc2d({
        center: Vec.Cast(info.handleArc.center),
        start: Vec.Cast(info.start.point),
        end: Vec.Cast(info.end.point),
        sweepFlag: info.bodyArc.sweepFlag,
        largeArcFlag: info.bodyArc.largeArcFlag,
      });

  if (shape.props.text.trim()) {
    const bodyBounds = bodyGeom.bounds;

    const fontSize = getArrowLabelFontSize(shape);

    const { w, h } = editor.textMeasure.measureText(shape.props.text, {
      ...TEXT_PROPS,
      fontFamily: FONT_FAMILIES[shape.props.font],
      fontSize,
      maxWidth: null,
    });

    width = w;
    height = h;

    if (bodyBounds.width > bodyBounds.height) {
      width = Math.max(Math.min(w, 64), Math.min(bodyBounds.width - 64, w));

      const { w: squishedWidth, h: squishedHeight } =
        editor.textMeasure.measureText(shape.props.text, {
          ...TEXT_PROPS,
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize,
          maxWidth: width,
        });

      width = squishedWidth;
      height = squishedHeight;
    }

    if (width > 16 * fontSize) {
      width = 16 * fontSize;

      const { w: squishedWidth, h: squishedHeight } =
        editor.textMeasure.measureText(shape.props.text, {
          ...TEXT_PROPS,
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize,
          maxWidth: width,
        });

      width = squishedWidth;
      height = squishedHeight;
    }
  }

  const size = new Vec(width, height).addScalar(
    ARROW_LABEL_PADDING * 2 * shape.props.scale,
  );
  labelSizeCache.set(shape, size);
  return size;
}
function getStraightArrowLabelRange(
  editor: Editor,
  shape: DiscourseRelationShape,
  info: Extract<RelationInfo, { isStraight: true }>,
): { start: number; end: number } {
  const labelSize = getArrowLabelSize(editor, shape);
  const labelToArrowPadding = getLabelToArrowPadding(shape);

  // take the start and end points of the arrow, and nudge them in a bit to give some spare space:
  const startOffset = Vec.Nudge(
    info.start.point,
    info.end.point,
    labelToArrowPadding,
  );
  const endOffset = Vec.Nudge(
    info.end.point,
    info.start.point,
    labelToArrowPadding,
  );

  // assuming we just stick the label in the middle of the shape, where does the arrow intersect the label?
  const intersectionPoints = intersectLineSegmentPolygon(
    startOffset,
    endOffset,
    Box.FromCenter(info.middle, labelSize).corners,
  );
  if (!intersectionPoints || intersectionPoints.length !== 2) {
    return { start: 0.5, end: 0.5 };
  }

  // there should be two intersection points - one near the start, and one near the end
  // after the existing guard:
  if (!intersectionPoints || intersectionPoints.length !== 2)
    return { start: 0.5, end: 0.5 };

  // replace destructure with a tuple cast
  let [startIntersect, endIntersect] = intersectionPoints as [VecLike, VecLike];
  if (
    Vec.Dist2(startIntersect, startOffset) >
    Vec.Dist2(endIntersect, startOffset)
  ) {
    [endIntersect, startIntersect] = intersectionPoints as [VecLike, VecLike];
  }

  // take our nudged start and end points and scooch them in even further to give us the possible
  // range for the position of the _center_ of the label
  const startConstrained = startOffset.add(
    Vec.Sub(info.middle, startIntersect),
  );
  const endConstrained = endOffset.add(Vec.Sub(info.middle, endIntersect));

  // now we can work out the range of possible label positions
  const start = Vec.Dist(info.start.point, startConstrained) / info.length;
  const end = Vec.Dist(info.start.point, endConstrained) / info.length;
  return { start, end };
}
export function getSolidCurvedArrowPath(
  info: RelationInfo & { isStraight: false },
) {
  const {
    start,
    end,
    bodyArc: { radius, largeArcFlag, sweepFlag },
  } = info;
  return `M${start.point.x},${start.point.y} A${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.point.x},${end.point.y}`;
}
export function getArrowLabelPosition(
  editor: Editor,
  shape: DiscourseRelationShape,
) {
  let labelCenter;
  const debugGeom: Geometry2d[] = [];
  const info = getArrowInfo(editor, shape)!;

  const hasStartBinding = !!info.bindings.start;
  const hasEndBinding = !!info.bindings.end;
  const hasStartArrowhead = info.start.arrowhead !== "none";
  const hasEndArrowhead = info.end.arrowhead !== "none";
  if (info.isStraight) {
    const range = getStraightArrowLabelRange(editor, shape, info);
    let clampedPosition = clamp(
      shape.props.labelPosition,
      hasStartArrowhead || hasStartBinding ? range.start : 0,
      hasEndArrowhead || hasEndBinding ? range.end : 1,
    );
    // This makes the position snap in the middle.
    clampedPosition =
      clampedPosition >= 0.48 && clampedPosition <= 0.52
        ? 0.5
        : clampedPosition;
    labelCenter = Vec.Lrp(info.start.point, info.end.point, clampedPosition);
  } else {
    const range = getCurvedArrowLabelRange(editor, shape, info);
    if (range.dbg) debugGeom.push(...range.dbg);
    let clampedPosition = clamp(
      shape.props.labelPosition,
      hasStartArrowhead || hasStartBinding ? range.start : 0,
      hasEndArrowhead || hasEndBinding ? range.end : 1,
    );
    // This makes the position snap in the middle.
    clampedPosition =
      clampedPosition >= 0.48 && clampedPosition <= 0.52
        ? 0.5
        : clampedPosition;
    const labelAngle = interpolateArcAngles(
      Vec.Angle(info.bodyArc.center, info.start.point),
      Vec.Angle(info.bodyArc.center, info.end.point),
      Math.sign(shape.props.bend),
      clampedPosition,
    );
    labelCenter = getPointOnCircle(
      info.bodyArc.center,
      info.bodyArc.radius,
      labelAngle,
    );
  }

  const labelSize = getArrowLabelSize(editor, shape);

  return { box: Box.FromCenter(labelCenter, labelSize), debugGeom };
}
export function getArrowLabelFontSize(shape: DiscourseRelationShape) {
  return ARROW_LABEL_FONT_SIZES[shape.props.size] * shape.props.scale;
}
function getLabelToArrowPadding(shape: DiscourseRelationShape) {
  const strokeWidth = STROKE_SIZES[shape.props.size];
  const labelToArrowPadding =
    (LABEL_TO_ARROW_PADDING +
      (strokeWidth - STROKE_SIZES.s) * 2 +
      (strokeWidth === STROKE_SIZES.xl ? 20 : 0)) *
    shape.props.scale;

  return labelToArrowPadding;
}
function getCurvedArrowLabelRange(
  editor: Editor,
  shape: DiscourseRelationShape,
  info: Extract<RelationInfo, { isStraight: false }>,
): { start: number; end: number; dbg?: Geometry2d[] } {
  const labelSize = getArrowLabelSize(editor, shape);
  const labelToArrowPadding = getLabelToArrowPadding(shape);
  const direction = Math.sign(shape.props.bend);

  // take the start and end points of the arrow, and nudge them in a bit to give some spare space:
  const labelToArrowPaddingRad =
    (labelToArrowPadding / info.handleArc.radius) * direction;
  const startOffsetAngle =
    Vec.Angle(info.bodyArc.center, info.start.point) - labelToArrowPaddingRad;
  const endOffsetAngle =
    Vec.Angle(info.bodyArc.center, info.end.point) + labelToArrowPaddingRad;
  const startOffset = getPointOnCircle(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle,
  );
  const endOffset = getPointOnCircle(
    info.bodyArc.center,
    info.bodyArc.radius,
    endOffsetAngle,
  );

  const dbg: Geometry2d[] = [];

  // unlike the straight arrow, we can't just stick the label in the middle of the shape when
  // we're working out the range. this is because as the label moves along the curve, the place
  // where the arrow intersects with label changes. instead, we have to stick the label center on
  // the `startOffset` (the start-most place where it can go), then find where it intersects with
  // the arc. because of the symmetry of the label rectangle, we can move the label to that new
  // center and take that as the start-most possible point.
  const startIntersections = intersectArcPolygon(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle,
    endOffsetAngle,
    direction,
    Box.FromCenter(startOffset, labelSize).corners,
  );

  dbg.push(
    new Polygon2d({
      points: Box.FromCenter(startOffset, labelSize).corners,
      debugColor: "lime",
      isFilled: false,
      ignore: true,
    }),
  );

  const endIntersections = intersectArcPolygon(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle,
    endOffsetAngle,
    direction,
    Box.FromCenter(endOffset, labelSize).corners,
  );

  dbg.push(
    new Polygon2d({
      points: Box.FromCenter(endOffset, labelSize).corners,
      debugColor: "lime",
      isFilled: false,
      ignore: true,
    }),
  );
  for (const pt of [
    ...(startIntersections ?? []),
    ...(endIntersections ?? []),
    startOffset,
    endOffset,
  ]) {
    dbg.push(
      new Circle2d({
        x: pt.x - 3,
        y: pt.y - 3,
        radius: 3,
        isFilled: false,
        debugColor: "magenta",
        ignore: true,
      }),
    );
  }

  // if we have one or more intersections (we shouldn't have more than two) then the one we need
  // is the one furthest from the arrow terminal
  const startConstrained =
    (startIntersections && furthest(info.start.point, startIntersections)) ??
    info.middle;
  const endConstrained =
    (endIntersections && furthest(info.end.point, endIntersections)) ??
    info.middle;

  const startAngle = Vec.Angle(info.bodyArc.center, info.start.point);
  const endAngle = Vec.Angle(info.bodyArc.center, info.end.point);
  const constrainedStartAngle = Vec.Angle(
    info.bodyArc.center,
    startConstrained,
  );
  const constrainedEndAngle = Vec.Angle(info.bodyArc.center, endConstrained);

  // if the arc is small enough that there's no room for the label to move, we constrain it to the middle.
  if (
    angleDistance(startAngle, constrainedStartAngle, direction) >
    angleDistance(startAngle, constrainedEndAngle, direction)
  ) {
    return { start: 0.5, end: 0.5, dbg };
  }

  // now we can work out the range of possible label positions
  const fullDistance = angleDistance(startAngle, endAngle, direction);
  const start =
    angleDistance(startAngle, constrainedStartAngle, direction) / fullDistance;
  const end =
    angleDistance(startAngle, constrainedEndAngle, direction) / fullDistance;
  return { start, end, dbg };
}
function furthest(from: VecLike, candidates: VecLike[]): VecLike | null {
  let furthest: VecLike | null = null;
  let furthestDist = -Infinity;

  for (const candidate of candidates) {
    const dist = Vec.Dist2(from, candidate);
    if (dist > furthestDist) {
      furthest = candidate;
      furthestDist = dist;
    }
  }

  return furthest;
}
function interpolateArcAngles(
  angleStart: number,
  angleEnd: number,
  direction: number,
  t: number,
) {
  const dist = angleDistance(angleStart, angleEnd, direction);
  return angleStart + dist * t * direction * -1;
}
function intersectArcPolygon(
  center: VecLike,
  radius: number,
  angleStart: number,
  angleEnd: number,
  direction: number,
  polygon: VecLike[],
) {
  const intersections = intersectCirclePolygon(center, radius, polygon);

  // filter the circle intersections to just the ones from the arc
  const fullArcDistance = angleDistance(angleStart, angleEnd, direction);
  return intersections?.filter((pt) => {
    const pDistance = angleDistance(
      angleStart,
      Vec.Angle(center, pt),
      direction,
    );
    return pDistance >= 0 && pDistance <= fullArcDistance;
  });
}
export function getFillDefForExport(fill: TLDefaultFillStyle): SvgExportDef {
  return {
    key: `${DefaultFontStyle.id}:${fill}`,
    getElement: async () => {
      if (fill !== "pattern") return null;

      return <HashPatternForExport />;
    },
  };
}
export const SvgTextLabel = ({
  fontSize,
  font,
  align,
  verticalAlign,
  text,
  labelColor,
  bounds,
  padding = 16,
  stroke = true,
}: {
  fontSize: number;
  font: TLDefaultFontStyle;
  // fill?: TLDefaultFillStyle
  align: TLDefaultHorizontalAlignStyle;
  verticalAlign: TLDefaultVerticalAlignStyle;
  wrap?: boolean;
  text: string;
  labelColor: string;
  bounds: Box;
  padding?: number;
  stroke?: boolean;
}) => {
  const editor = useEditor();
  const theme = useDefaultColorTheme();

  const opts = {
    fontSize,
    fontFamily: DefaultFontFamilies[font],
    textAlign: align,
    verticalTextAlign: verticalAlign,
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
    padding,
    lineHeight: TEXT_PROPS.lineHeight,
    fontStyle: "normal",
    fontWeight: "normal",
    overflow: "wrap" as const,
    offsetX: 0,
    offsetY: 0,
    fill: labelColor,
    stroke: undefined as string | undefined,
    strokeWidth: undefined as number | undefined,
  };

  const spans = editor.textMeasure.measureTextSpans(text, opts);
  const offsetX = getLegacyOffsetX(align, padding, spans, bounds.width);
  if (offsetX) {
    opts.offsetX = offsetX;
  }

  opts.offsetX += bounds.x;
  opts.offsetY += bounds.y;

  const mainSpans = createTextJsxFromSpans(editor, spans, opts);

  let outlineSpans = null;
  if (stroke) {
    opts.fill = theme.background;
    opts.stroke = theme.background;
    opts.strokeWidth = 2;
    outlineSpans = createTextJsxFromSpans(editor, spans, opts);
  }

  return (
    <>
      {outlineSpans}
      {mainSpans}
    </>
  );
};

function getLegacyOffsetX(
  align: TLDefaultHorizontalAlignStyle | string,
  padding: number,
  spans: { text: string; box: BoxModel }[],
  totalWidth: number,
): number | undefined {
  if (
    (align === "start-legacy" || align === "end-legacy") &&
    spans.length !== 0
  ) {
    const spansBounds = Box.From(spans[0]?.box ?? new Box(0, 0, 0, 0));
    for (const { box } of spans) {
      spansBounds.union(box);
    }
    if (align === "start-legacy") {
      return (totalWidth - 2 * padding - spansBounds.width) / 2;
    } else if (align === "end-legacy") {
      return -(totalWidth - 2 * padding - spansBounds.width) / 2;
    }
  }
}
export function createTextJsxFromSpans(
  editor: Editor,
  spans: { text: string; box: BoxModel }[],
  opts: {
    fontSize: number;
    fontFamily: string;
    textAlign: TLDefaultHorizontalAlignStyle;
    verticalTextAlign: TLDefaultVerticalAlignStyle;
    fontWeight: string;
    fontStyle: string;
    width: number;
    height: number;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    padding?: number;
    offsetX?: number;
    offsetY?: number;
  },
) {
  const { padding = 0 } = opts;
  if (spans.length === 0) return null;

  const bounds = Box.From(spans[0]?.box ?? new Box(0, 0, 0, 0));
  for (const { box } of spans) {
    bounds.union(box);
  }

  const offsetX = padding + (opts.offsetX ?? 0);
  const offsetY =
    (opts.offsetY ?? 0) +
    opts.fontSize / 2 +
    (opts.verticalTextAlign === "start"
      ? padding
      : opts.verticalTextAlign === "end"
        ? opts.height - padding - bounds.height
        : (Math.ceil(opts.height) - bounds.height) / 2);

  // Create text span elements for each word
  let currentLineTop = null;
  const children = [];
  for (const { text, box } of spans) {
    // if we broke a line, add a line break span. This helps tools like
    // figma import our exported svg correctly
    const didBreakLine = currentLineTop !== null && box.y > currentLineTop;
    if (didBreakLine) {
      children.push(
        <tspan
          key={children.length}
          alignmentBaseline="mathematical"
          x={offsetX}
          y={box.y + offsetY}
        >
          {"\n"}
        </tspan>,
      );
    }

    children.push(
      <tspan
        key={children.length}
        alignmentBaseline="mathematical"
        x={box.x + offsetX}
        y={box.y + offsetY}
        // N.B. This property, while discouraged ("intended for Document Type Definition (DTD) designers")
        // is necessary for ensuring correct mixed RTL/LTR behavior when exporting SVGs.
        unicodeBidi="plaintext"
      >
        {correctSpacesToNbsp(text)}
      </tspan>,
    );

    currentLineTop = box.y;
  }
  function correctSpacesToNbsp(input: string) {
    return input.replace(/\s/g, "\xa0");
  }
  return (
    <text
      fontSize={opts.fontSize}
      fontFamily={opts.fontFamily}
      fontStyle={opts.fontStyle}
      fontWeight={opts.fontWeight}
      dominantBaseline="mathematical"
      alignmentBaseline="mathematical"
      stroke={opts.stroke}
      strokeWidth={opts.strokeWidth}
      fill={opts.fill}
    >
      {children}
    </text>
  );
}
export function getFontDefForExport(
  fontStyle: TLDefaultFontStyle,
): SvgExportDef {
  return {
    key: `${DefaultFontStyle.id}:${fontStyle}`,
    getElement: async () => {
      const font = findFont(fontStyle);
      if (!font) return null;

      const url: string = (font as any).$$_url;
      const fontFaceRule: string = (font as any).$$_fontface;
      if (!url || !fontFaceRule) return null;

      const fontFile = await (await fetch(url)).blob();
      const base64FontFile = await FileHelpers.blobToDataUrl(fontFile);

      const newFontFaceRule = fontFaceRule.replace(url, base64FontFile);
      return <style>{newFontFaceRule}</style>;
    },
  };
}
function findFont(name: TLDefaultFontStyle): FontFace | null {
  const fontFamily = DefaultFontFamilies[name];
  for (const font of document.fonts) {
    if (fontFamily.includes(font.family)) {
      return font;
    }
  }
  return null;
}
export function getFillDefForCanvas(): TLShapeUtilCanvasSvgDef {
  return {
    key: `${DefaultFontStyle.id}:pattern`,
    component: PatternFillDefForCanvas,
  };
}
function findHtmlLayerParent(element: Element): HTMLElement | null {
  if (element.classList.contains("tl-html-layer"))
    return element as HTMLElement;
  if (element.parentElement) return findHtmlLayerParent(element.parentElement);
  return null;
}
const canvasBlob = (
  size: [number, number],
  fn: (ctx: CanvasRenderingContext2D) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size[0];
  canvas.height = size[1];
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  fn(ctx);
  return canvas.toDataURL();
};
const generateImage = (dpr: number, currentZoom: number, darkMode: boolean) => {
  return new Promise<Blob>((resolve, reject) => {
    const size = TILE_PATTERN_SIZE * currentZoom * dpr;

    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = darkMode
      ? DefaultColorThemePalette.darkMode.solid
      : DefaultColorThemePalette.lightMode.solid;
    ctx.fillRect(0, 0, size, size);

    // This essentially generates an inverse of the pattern we're drawing.
    ctx.globalCompositeOperation = "destination-out";

    ctx.lineCap = "round";
    ctx.lineWidth = 1.25 * currentZoom * dpr;

    const t = 8 / 12;
    const s = (v: number) => v * currentZoom * dpr;

    ctx.beginPath();
    ctx.moveTo(s(t * 1), s(t * 3));
    ctx.lineTo(s(t * 3), s(t * 1));

    ctx.moveTo(s(t * 5), s(t * 7));
    ctx.lineTo(s(t * 7), s(t * 5));

    ctx.moveTo(s(t * 9), s(t * 11));
    ctx.lineTo(s(t * 11), s(t * 9));
    ctx.stroke();

    canvasEl.toBlob((blob) => {
      if (
        !blob
        // || debugFlags.throwToBlob.get()
      ) {
        reject();
      } else {
        resolve(blob);
      }
    });
  });
};
function getDefaultPixels() {
  if (!defaultPixels) {
    defaultPixels = {
      white: canvasBlob([1, 1], (ctx) => {
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(0, 0, 1, 1);
      }),
      black: canvasBlob([1, 1], (ctx) => {
        ctx.fillStyle = "#212529";
        ctx.fillRect(0, 0, 1, 1);
      }),
    };
  }
  return defaultPixels;
}
function getPatternLodsToGenerate(maxZoom: number) {
  const levels = [];
  const minLod = 0;
  const maxLod = getPatternLodForZoomLevel(maxZoom);
  for (let i = minLod; i <= maxLod; i++) {
    levels.push(Math.pow(2, i));
  }
  return levels;
}
function getDefaultPatterns(maxZoom: number): PatternDef[] {
  const defaultPixels = getDefaultPixels();
  return getPatternLodsToGenerate(maxZoom).flatMap((zoom) => [
    { zoom, url: defaultPixels.white, theme: "light" },
    { zoom, url: defaultPixels.black, theme: "dark" },
  ]);
}
function PatternFillDefForCanvas() {
  const editor = useEditor();
  const containerRef = useRef<SVGGElement>(null);
  const { defs, isReady } = usePattern();

  useEffect(() => {
    if (isReady && editor.environment.isSafari) {
      const htmlLayer = findHtmlLayerParent(containerRef.current!);
      if (htmlLayer) {
        // Wait for `patternContext` to be picked up
        editor.timers.requestAnimationFrame(() => {
          htmlLayer.style.display = "none";

          // Wait for 'display = "none"' to take effect
          editor.timers.requestAnimationFrame(() => {
            htmlLayer.style.display = "";
          });
        });
      }
    }
  }, [editor, isReady]);

  return (
    <g
      ref={containerRef}
      data-testid={isReady ? "ready-pattern-fill-defs" : undefined}
    >
      {defs}
    </g>
  );
}
function usePattern() {
  const editor = useEditor();
  const dpr = useValue(
    "devicePixelRatio",
    () => editor.getInstanceState().devicePixelRatio,
    [editor],
  );
  const maxZoom = useValue(
    "maxZoom",
    () => Math.ceil(last(editor.getCameraOptions().zoomSteps)!),
    [editor],
  );
  const [isReady, setIsReady] = useState(false);
  const [backgroundUrls, setBackgroundUrls] = useState<PatternDef[]>(() =>
    getDefaultPatterns(maxZoom),
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      setIsReady(true);
      return;
    }

    const promise = Promise.all(
      getPatternLodsToGenerate(maxZoom).flatMap<Promise<PatternDef>>((zoom) => [
        generateImage(dpr, zoom, false).then((blob) => ({
          zoom,
          theme: "light",
          url: URL.createObjectURL(blob),
        })),
        generateImage(dpr, zoom, true).then((blob) => ({
          zoom,
          theme: "dark",
          url: URL.createObjectURL(blob),
        })),
      ]),
    );

    let isCancelled = false;
    promise.then((urls) => {
      if (isCancelled) return;
      setBackgroundUrls(urls);
      setIsReady(true);
    });
    return () => {
      isCancelled = true;
      setIsReady(false);
      promise.then((patterns) => {
        for (const { url } of patterns) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [dpr, maxZoom]);

  const defs = (
    <>
      {backgroundUrls.map((item) => {
        const id = getHashPatternZoomName(item.zoom, item.theme);
        return (
          <pattern
            key={id}
            id={id}
            width={TILE_PATTERN_SIZE}
            height={TILE_PATTERN_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <image
              href={item.url}
              width={TILE_PATTERN_SIZE}
              height={TILE_PATTERN_SIZE}
            />
          </pattern>
        );
      })}
    </>
  );

  return { defs, isReady };
}
function last<T>(arr: readonly T[]): T | undefined {
  return arr[arr.length - 1];
}
export function ArrowheadDotDef() {
  return (
    <marker
      id="arrowhead-dot"
      className="tl-arrow-hint"
      refX="3.0"
      refY="3.0"
      orient="0"
    >
      <circle cx="3" cy="3" r="2" strokeDasharray="100%" />
    </marker>
  );
}
export function ArrowheadCrossDef() {
  return (
    <marker
      id="arrowhead-cross"
      className="tl-arrow-hint"
      refX="3.0"
      refY="3.0"
      orient="auto"
    >
      <line x1="1.5" y1="1.5" x2="4.5" y2="4.5" strokeDasharray="100%" />
      <line x1="1.5" y1="4.5" x2="4.5" y2="1.5" strokeDasharray="100%" />
    </marker>
  );
}
function getCurvedArrowHandlePath(info: RelationInfo & { isStraight: false }) {
  const {
    start,
    end,
    handleArc: { radius, largeArcFlag, sweepFlag },
  } = info;
  return `M${start.handle.x},${start.handle.y} A${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.handle.x},${end.handle.y}`;
}
function isLegacyAlign(align: TLDefaultHorizontalAlignStyle | string): boolean {
  return (
    align === "start-legacy" ||
    align === "middle-legacy" ||
    align === "end-legacy"
  );
}
function HashPatternForExport() {
  const theme = useDefaultColorTheme();
  const t = 8 / 12;
  return (
    <>
      <mask id="hash_pattern_mask">
        <rect x="0" y="0" width="8" height="8" fill="white" />
        <g strokeLinecap="round" stroke="black">
          <line x1={t * 1} y1={t * 3} x2={t * 3} y2={t * 1} />
          <line x1={t * 5} y1={t * 7} x2={t * 7} y2={t * 5} />
          <line x1={t * 9} y1={t * 11} x2={t * 11} y2={t * 9} />
        </g>
      </mask>
      <pattern
        id={getHashPatternZoomName(1, theme.id)}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
      >
        <rect
          x="0"
          y="0"
          width="8"
          height="8"
          fill={theme.solid}
          mask="url(#hash_pattern_mask)"
        />
      </pattern>
    </>
  );
}
export function removeArrowBinding(
  editor: Editor,
  relation: DiscourseRelationShape,
  terminal: "start" | "end",
) {
  const existing = editor
    .getBindingsFromShape<RelationBinding>(relation, relation.type) // we expect relation.type to = binding.type
    .filter((b) => b.props.terminal === terminal);

  editor.deleteBindings(existing);
}
export function createOrUpdateArrowBinding(
  editor: Editor,
  relation: DiscourseRelationShape,
  target: TLShape | TLShapeId,
  props: TLArrowBindingProps,
  shouldCreateRelation = false,
) {
  const arrowId = typeof relation === "string" ? relation : relation.id;
  const targetId = typeof target === "string" ? target : target.id;

  const existingMany = editor
    .getBindingsFromShape<RelationBinding>(
      arrowId,
      relation.type, // we expect relation.type to = binding.type
    )
    .filter((b) => b.props.terminal === props.terminal);

  // if we've somehow ended up with too many bindings, delete the extras
  if (existingMany.length > 1) {
    editor.deleteBindings(existingMany.slice(1));
  }

  const existing = existingMany[0];
  if (existing) {
    editor.updateBinding({
      ...existing,
      toId: targetId,
      props,
    });
  } else {
    editor.createBinding({
      type: relation.type,
      fromId: arrowId,
      toId: targetId,
      props,
    });
    const util = editor.getShapeUtil<DiscourseRelationShape>({
      id: relation.id,
      type: relation.type,
    });
    if (util instanceof DiscourseRelationUtil && shouldCreateRelation) {
      // @ts-expect-error TODO: fix this
      util?.handleCreateRelationsInRoam({
        arrow: relation,
        targetId,
      });
    }
  }
}
export const shapeAtTranslationStart = new WeakMap<
  DiscourseRelationShape,
  {
    pagePosition: Vec;
    terminalBindings: Record<
      "start" | "end",
      {
        pagePosition: Vec;
        shapePosition: Vec;
        binding: RelationBinding;
      } | null
    >;
  }
>();
export function mapObjectMapValues<Key extends string, ValueBefore, ValueAfter>(
  object: { readonly [K in Key]: ValueBefore },
  mapper: (key: Key, value: ValueBefore) => ValueAfter,
): { [K in Key]: ValueAfter } {
  const result = {} as { [K in Key]: ValueAfter };
  for (const [key, value] of objectMapEntries(object)) {
    const newValue = mapper(key, value);
    result[key] = newValue;
  }
  return result;
}
function objectMapEntries<Key extends string, Value>(object: {
  [K in Key]: Value;
}): Array<[Key, Value]> {
  return Object.entries(object) as [Key, Value][];
}
export function updateArrowTerminal({
  editor,
  relation,
  terminal,
  unbind = false,
  useHandle = false,
}: {
  editor: Editor;
  relation: DiscourseRelationShape;
  terminal: "start" | "end";
  unbind?: boolean;
  useHandle?: boolean;
}) {
  const info = getArrowInfo(editor, relation);
  if (!info) {
    throw new Error("expected arrow info");
  }

  const startPoint = useHandle ? info.start.handle : info.start.point;
  const endPoint = useHandle ? info.end.handle : info.end.point;
  const point = terminal === "start" ? startPoint : endPoint;

  const update = {
    id: relation.id,
    type: relation.type,
    props: {
      [terminal]: { x: point.x, y: point.y },
      bend: relation.props.bend,
    },
  } satisfies TLShapePartial<DiscourseRelationShape>;

  // fix up the bend:
  if (!info.isStraight) {
    // find the new start/end points of the resulting arrow
    const newStart = terminal === "start" ? startPoint : info.start.handle;
    const newEnd = terminal === "end" ? endPoint : info.end.handle;
    const newMidPoint = Vec.Med(newStart, newEnd);

    // intersect a line segment perpendicular to the new arrow with the old arrow arc to
    // find the new mid-point
    const lineSegment = Vec.Sub(newStart, newEnd)
      .per()
      .uni()
      .mul(info.handleArc.radius * 2 * Math.sign(relation.props.bend));

    // find the intersections with the old arrow arc:
    const intersections = intersectLineSegmentCircle(
      info.handleArc.center,
      Vec.Add(newMidPoint, lineSegment),
      info.handleArc.center,
      info.handleArc.radius,
    );

    if (intersections?.length !== 1) {
      throw new Error("expected 1 intersection");
    }
    const bend =
      Vec.Dist(newMidPoint, intersections[0]!) * Math.sign(relation.props.bend);
    // use `approximately` to avoid endless update loops
    if (!approximately(bend, update.props.bend)) {
      update.props.bend = bend;
    }
  }

  editor.updateShape(update);
  if (unbind) {
    removeArrowBinding(editor, relation, terminal);
  }
}
function intersectLineSegmentCircle(
  a1: VecLike,
  a2: VecLike,
  c: VecLike,
  r: number,
) {
  const a = (a2.x - a1.x) * (a2.x - a1.x) + (a2.y - a1.y) * (a2.y - a1.y);
  const b = 2 * ((a2.x - a1.x) * (a1.x - c.x) + (a2.y - a1.y) * (a1.y - c.y));
  const cc =
    c.x * c.x +
    c.y * c.y +
    a1.x * a1.x +
    a1.y * a1.y -
    2 * (c.x * a1.x + c.y * a1.y) -
    r * r;
  const deter = b * b - 4 * a * cc;

  if (deter < 0) return null; // outside
  if (deter === 0) return null; // tangent

  const e = Math.sqrt(deter);
  const u1 = (-b + e) / (2 * a);
  const u2 = (-b - e) / (2 * a);

  if ((u1 < 0 || u1 > 1) && (u2 < 0 || u2 > 1)) {
    return null; // outside or inside
    // if ((u1 < 0 && u2 < 0) || (u1 > 1 && u2 > 1)) {
    // 	return null // outside
    // } else return null // inside'
  }

  const result: VecLike[] = [];

  if (0 <= u1 && u1 <= 1) result.push(Vec.Lrp(a1, a2, u1));
  if (0 <= u2 && u2 <= 1) result.push(Vec.Lrp(a1, a2, u2));

  if (result.length === 0) return null; // no intersection

  return result;
}
export const assert: (value: unknown, message?: string) => asserts value =
  omitFromStackTrace((value, message) => {
    if (!value) {
      throw new Error(message || "Assertion Error");
    }
  });
export function omitFromStackTrace<Args extends Array<unknown>, Return>(
  fn: (...args: Args) => Return,
): (...args: Args) => Return {
  const wrappedFn = (...args: Args) => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof Error && Error.captureStackTrace) {
        Error.captureStackTrace(error, wrappedFn);
      }
      throw error;
    }
  };

  return wrappedFn;
}
export function approximately(a: number, b: number, precision = 0.000001) {
  return Math.abs(a - b) <= precision;
}
export const ArrowSvg = track(function ArrowSvg({
  shape,
  shouldDisplayHandles,
}: // color,
{
  shape: DiscourseRelationShape;
  shouldDisplayHandles: boolean;
  // color: string;
}) {
  const editor = useEditor();
  // const theme = useDefaultColorTheme();
  const info = getArrowInfo(editor, shape);
  const bounds = Box.ZeroFix(editor.getShapeGeometry(shape).bounds);
  const bindings = getArrowBindings(editor, shape);

  const changeIndex = React.useMemo<number>(() => {
    return editor.environment.isSafari ? (globalRenderIndex += 1) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  if (!info?.isValid) return null;

  const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;

  const as =
    info.start.arrowhead && getArrowheadPathForType(info, "start", strokeWidth);
  const ae =
    info.end.arrowhead && getArrowheadPathForType(info, "end", strokeWidth);

  const path = info.isStraight
    ? getSolidStraightArrowPath(info)
    : getSolidCurvedArrowPath(info);

  let handlePath: null | React.ReactNode = null;

  if (shouldDisplayHandles) {
    const sw = 2 / editor.getZoomLevel();
    const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
      getLength(editor, shape),
      sw,
      {
        end: "skip",
        start: "skip",
        lengthRatio: 2.5,
      },
    );

    handlePath =
      bindings.start || bindings.end ? (
        <path
          className="tl-arrow-hint"
          d={
            info.isStraight
              ? getStraightArrowHandlePath(info)
              : getCurvedArrowHandlePath(info)
          }
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeWidth={sw}
          markerStart={
            bindings.start
              ? bindings.start.props.isExact
                ? ""
                : bindings.start.props.isPrecise
                  ? "url(#arrowhead-cross)"
                  : "url(#arrowhead-dot)"
              : ""
          }
          markerEnd={
            bindings.end
              ? bindings.end.props.isExact
                ? ""
                : bindings.end.props.isPrecise
                  ? "url(#arrowhead-cross)"
                  : "url(#arrowhead-dot)"
              : ""
          }
          opacity={0.16}
        />
      ) : null;
  }

  const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
    info.isStraight ? info.length : Math.abs(info.bodyArc.length),
    strokeWidth,
    {
      style: shape.props.dash,
    },
  );

  const labelPosition = getArrowLabelPosition(editor, shape);

  const maskStartArrowhead = !(
    info.start.arrowhead === "none" || info.start.arrowhead === "arrow"
  );
  const maskEndArrowhead = !(
    info.end.arrowhead === "none" || info.end.arrowhead === "arrow"
  );

  // NOTE: I know right setting `changeIndex` hacky-as right! But we need this because otherwise safari loses
  // the mask, see <https://linear.app/tldraw/issue/TLD-1500/changing-arrow-color-makes-line-pass-through-text>
  const maskId = (shape.id + "_clip_" + changeIndex).replace(":", "_");

  return (
    <>
      {/* Yep */}
      <defs>
        <mask id={maskId}>
          <rect
            x={toDomPrecision(-100 + bounds.minX)}
            y={toDomPrecision(-100 + bounds.minY)}
            width={toDomPrecision(bounds.width + 200)}
            height={toDomPrecision(bounds.height + 200)}
            fill="white"
          />
          {shape.props.text.trim() && (
            <rect
              x={labelPosition.box.x}
              y={labelPosition.box.y}
              width={labelPosition.box.w}
              height={labelPosition.box.h}
              fill="black"
              rx={4}
              ry={4}
            />
          )}
          {as && maskStartArrowhead && (
            <path
              d={as}
              fill={info.start.arrowhead === "arrow" ? "none" : "black"}
              stroke="none"
            />
          )}
          {ae && maskEndArrowhead && (
            <path
              d={ae}
              fill={info.end.arrowhead === "arrow" ? "none" : "black"}
              stroke="none"
            />
          )}
        </mask>
      </defs>
      <g
        fill="none"
        stroke={shape.props.color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        pointerEvents="none"
      >
        {handlePath}
        {/* firefox will clip if you provide a maskURL even if there is no mask matching that URL in the DOM */}
        <g mask={`url(#${maskId})`}>
          <rect
            x={toDomPrecision(bounds.minX - 100)}
            y={toDomPrecision(bounds.minY - 100)}
            width={toDomPrecision(bounds.width + 200)}
            height={toDomPrecision(bounds.height + 200)}
            opacity={0}
          />
          <path
            d={path}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
          />
        </g>
        {as && maskStartArrowhead && shape.props.fill !== "none" && (
          <ShapeFill
            // theme={theme}
            d={as}
            color={shape.props.color}
            fill={shape.props.fill}
            scale={shape.props.scale}
          />
        )}
        {ae && maskEndArrowhead && shape.props.fill !== "none" && (
          <ShapeFill
            // theme={theme}
            d={ae}
            color={shape.props.color}
            fill={shape.props.fill}
            scale={shape.props.scale}
          />
        )}
        {as && <path d={as} />}
        {ae && <path d={ae} />}
      </g>
    </>
  );
});
export const ShapeFill = React.memo(function ShapeFill({
  // theme,
  d,
  color,
  fill,
  scale,
}: ShapeFillProps) {
  switch (fill) {
    case "none": {
      return null;
    }
    case "solid": {
      return <path fill={color} d={d} />;
    }
    case "semi": {
      return <path fill={color} d={d} />;
    }
    case "fill": {
      return <path fill={color} d={d} />;
    }
    case "pattern": {
      return (
        <PatternFill
          // theme={theme}
          color={color}
          fill={fill}
          d={d}
          scale={scale}
        />
      );
    }
  }
});
function getIsArrowStraight(shape: DiscourseRelationShape) {
  return Math.abs(shape.props.bend) < MIN_ARROW_BEND * shape.props.scale; // snap to +-8px
}
function getCurvedArrowInfo(
  editor: Editor,
  shape: DiscourseRelationShape,
  bindings: RelationBindings,
): RelationInfo {
  const { arrowheadEnd, arrowheadStart } = shape.props;
  const bend = shape.props.bend;

  if (
    Math.abs(bend) >
    Math.abs(
      shape.props.bend * (WAY_TOO_BIG_ARROW_BEND_FACTOR * shape.props.scale),
    )
  ) {
    return getStraightArrowInfo(editor, shape, bindings);
  }

  const terminalsInArrowSpace = getArrowTerminalsInArrowSpace(
    editor,
    shape,
    bindings,
  );

  const med = Vec.Med(terminalsInArrowSpace.start, terminalsInArrowSpace.end); // point between start and end
  const distance = Vec.Sub(
    terminalsInArrowSpace.end,
    terminalsInArrowSpace.start,
  );
  // Check for divide-by-zero before we call uni()
  const u = Vec.Len(distance) ? distance.uni() : Vec.From(distance); // unit vector between start and end
  const middle = Vec.Add(med, u.per().mul(-bend)); // middle handle

  const startShapeInfo = getBoundShapeInfoForTerminal(editor, shape, "start");
  const endShapeInfo = getBoundShapeInfoForTerminal(editor, shape, "end");

  // The positions of the body of the arrow, which may be different
  // than the arrow's start / end points if the arrow is bound to shapes
  const a = terminalsInArrowSpace.start.clone();
  const b = terminalsInArrowSpace.end.clone();
  const c = middle.clone();

  if (Vec.Equals(a, b)) {
    return {
      bindings,
      isStraight: true,
      start: {
        handle: a,
        point: a,
        arrowhead: shape.props.arrowheadStart,
      },
      end: {
        handle: b,
        point: b,
        arrowhead: shape.props.arrowheadEnd,
      },
      middle: c,
      isValid: false,
      length: 0,
    };
  }

  const isClockwise = shape.props.bend < 0;
  const distFn = isClockwise ? clockwiseAngleDist : counterClockwiseAngleDist;

  const handleArc = getArcInfo(a, b, c);
  const handle_aCA = Vec.Angle(handleArc.center, a);
  const handle_aCB = Vec.Angle(handleArc.center, b);
  const handle_dAB = distFn(handle_aCA, handle_aCB);

  if (
    handleArc.length === 0 ||
    handleArc.size === 0 ||
    !isSafeFloat(handleArc.length) ||
    !isSafeFloat(handleArc.size)
  ) {
    return getStraightArrowInfo(editor, shape, bindings);
  }

  const tempA = a.clone();
  const tempB = b.clone();
  const tempC = c.clone();

  const arrowPageTransform = editor.getShapePageTransform(shape)!;

  let offsetA = 0;
  let offsetB = 0;

  let minLength = MIN_ARROW_LENGTH * shape.props.scale;

  if (startShapeInfo && !startShapeInfo.isExact) {
    const startInPageSpace = Mat.applyToPoint(arrowPageTransform, tempA);
    const centerInPageSpace = Mat.applyToPoint(
      arrowPageTransform,
      handleArc.center,
    );
    const endInPageSpace = Mat.applyToPoint(arrowPageTransform, tempB);

    const inverseTransform = Mat.Inverse(startShapeInfo.transform);

    const startInStartShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      startInPageSpace,
    );
    const centerInStartShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      centerInPageSpace,
    );
    const endInStartShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      endInPageSpace,
    );

    const { isClosed } = startShapeInfo;
    const fn = isClosed ? intersectCirclePolygon : intersectCirclePolyline;

    let point: VecLike | undefined;

    let intersections = fn(
      centerInStartShapeLocalSpace,
      handleArc.radius,
      startShapeInfo.outline,
    );

    if (intersections) {
      const angleToStart = centerInStartShapeLocalSpace.angle(
        startInStartShapeLocalSpace,
      );
      const angleToEnd = centerInStartShapeLocalSpace.angle(
        endInStartShapeLocalSpace,
      );
      const dAB = distFn(angleToStart, angleToEnd);

      // Filter out any intersections that aren't in the arc
      intersections = intersections.filter(
        (pt) =>
          distFn(angleToStart, centerInStartShapeLocalSpace.angle(pt)) <= dAB,
      );

      const targetDist = dAB * 0.25;

      intersections.sort(
        isClosed
          ? (p0, p1) =>
              Math.abs(
                distFn(angleToStart, centerInStartShapeLocalSpace.angle(p0)) -
                  targetDist,
              ) <
              Math.abs(
                distFn(angleToStart, centerInStartShapeLocalSpace.angle(p1)) -
                  targetDist,
              )
                ? -1
                : 1
          : (p0, p1) =>
              distFn(angleToStart, centerInStartShapeLocalSpace.angle(p0)) <
              distFn(angleToStart, centerInStartShapeLocalSpace.angle(p1))
                ? -1
                : 1,
      );

      point =
        intersections[0] ??
        (isClosed ? undefined : startInStartShapeLocalSpace);
    } else {
      point = isClosed ? undefined : startInStartShapeLocalSpace;
    }

    if (point) {
      tempA.setTo(
        editor.getPointInShapeSpace(
          shape,
          Mat.applyToPoint(startShapeInfo.transform, point),
        ),
      );

      startShapeInfo.didIntersect = true;

      if (arrowheadStart !== "none") {
        const strokeOffset =
          STROKE_SIZES[shape.props.size] / 2 +
          ("size" in startShapeInfo.shape.props
            ? STROKE_SIZES[startShapeInfo.shape.props.size] / 2
            : 0);
        offsetA = (BOUND_ARROW_OFFSET + strokeOffset) * shape.props.scale;
        minLength += strokeOffset * shape.props.scale;
      }
    }
  }

  if (endShapeInfo && !endShapeInfo.isExact) {
    // get points in shape's coordinates?
    const startInPageSpace = Mat.applyToPoint(arrowPageTransform, tempA);
    const endInPageSpace = Mat.applyToPoint(arrowPageTransform, tempB);
    const centerInPageSpace = Mat.applyToPoint(
      arrowPageTransform,
      handleArc.center,
    );

    const inverseTransform = Mat.Inverse(endShapeInfo.transform);

    const startInEndShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      startInPageSpace,
    );
    const centerInEndShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      centerInPageSpace,
    );
    const endInEndShapeLocalSpace = Mat.applyToPoint(
      inverseTransform,
      endInPageSpace,
    );

    const isClosed = endShapeInfo.isClosed;
    const fn = isClosed ? intersectCirclePolygon : intersectCirclePolyline;

    let point: VecLike | undefined;

    let intersections = fn(
      centerInEndShapeLocalSpace,
      handleArc.radius,
      endShapeInfo.outline,
    );

    if (intersections) {
      const angleToStart = centerInEndShapeLocalSpace.angle(
        startInEndShapeLocalSpace,
      );
      const angleToEnd = centerInEndShapeLocalSpace.angle(
        endInEndShapeLocalSpace,
      );
      const dAB = distFn(angleToStart, angleToEnd);
      const targetDist = dAB * 0.75;

      // or simplified...

      intersections = intersections.filter(
        (pt) =>
          distFn(angleToStart, centerInEndShapeLocalSpace.angle(pt)) <= dAB,
      );

      intersections.sort(
        isClosed
          ? (p0, p1) =>
              Math.abs(
                distFn(angleToStart, centerInEndShapeLocalSpace.angle(p0)) -
                  targetDist,
              ) <
              Math.abs(
                distFn(angleToStart, centerInEndShapeLocalSpace.angle(p1)) -
                  targetDist,
              )
                ? -1
                : 1
          : (p0, p1) =>
              distFn(angleToStart, centerInEndShapeLocalSpace.angle(p0)) <
              distFn(angleToStart, centerInEndShapeLocalSpace.angle(p1))
                ? -1
                : 1,
      );

      if (intersections[0]) {
        point = intersections[0];
      } else {
        point = isClosed ? undefined : endInEndShapeLocalSpace;
      }
    } else {
      point = isClosed ? undefined : endInEndShapeLocalSpace;
    }

    if (point) {
      // Set b to target local point -> page point -> shape local point
      tempB.setTo(
        editor.getPointInShapeSpace(
          shape,
          Mat.applyToPoint(endShapeInfo.transform, point),
        ),
      );

      endShapeInfo.didIntersect = true;

      if (arrowheadEnd !== "none") {
        const strokeOffset =
          STROKE_SIZES[shape.props.size] / 2 +
          ("size" in endShapeInfo.shape.props
            ? STROKE_SIZES[endShapeInfo.shape.props.size] / 2
            : 0);
        offsetB = (BOUND_ARROW_OFFSET + strokeOffset) * shape.props.scale;
        minLength += strokeOffset * shape.props.scale;
      }
    }
  }

  // Apply arrowhead offsets

  let aCA = Vec.Angle(handleArc.center, tempA); // angle center -> a
  let aCB = Vec.Angle(handleArc.center, tempB); // angle center -> b
  let dAB = distFn(aCA, aCB); // angle distance between a and b
  let lAB = dAB * handleArc.radius; // length of arc between a and b

  // Try the offsets first, then check whether the distance between the points is too small;
  // if it is, flip the offsets and expand them. We need to do this using temporary points
  // so that we can apply them both in a balanced way.
  const tA = tempA.clone();
  const tB = tempB.clone();

  if (offsetA !== 0) {
    tA.setTo(handleArc.center).add(
      Vec.FromAngle(aCA + dAB * ((offsetA / lAB) * (isClockwise ? 1 : -1))).mul(
        handleArc.radius,
      ),
    );
  }

  if (offsetB !== 0) {
    tB.setTo(handleArc.center).add(
      Vec.FromAngle(aCB + dAB * ((offsetB / lAB) * (isClockwise ? -1 : 1))).mul(
        handleArc.radius,
      ),
    );
  }

  if (Vec.DistMin(tA, tB, minLength)) {
    if (offsetA !== 0 && offsetB !== 0) {
      offsetA *= -1.5;
      offsetB *= -1.5;
    } else if (offsetA !== 0) {
      offsetA *= -2;
    } else if (offsetB !== 0) {
      offsetB *= -2;
    } else {
      // noop
    }
  }

  if (offsetA !== 0) {
    tempA
      .setTo(handleArc.center)
      .add(
        Vec.FromAngle(
          aCA + dAB * ((offsetA / lAB) * (isClockwise ? 1 : -1)),
        ).mul(handleArc.radius),
      );
  }

  if (offsetB !== 0) {
    tempB
      .setTo(handleArc.center)
      .add(
        Vec.FromAngle(
          aCB + dAB * ((offsetB / lAB) * (isClockwise ? -1 : 1)),
        ).mul(handleArc.radius),
      );
  }

  // Did we miss intersections? This happens when we have overlapping shapes.
  if (
    startShapeInfo &&
    endShapeInfo &&
    !startShapeInfo.isExact &&
    !endShapeInfo.isExact
  ) {
    aCA = Vec.Angle(handleArc.center, tempA); // angle center -> a
    aCB = Vec.Angle(handleArc.center, tempB); // angle center -> b
    dAB = distFn(aCA, aCB); // angle distance between a and b
    lAB = dAB * handleArc.radius; // length of arc between a and b
    const relationship = getBoundShapeRelationships(
      editor,
      startShapeInfo.shape.id,
      endShapeInfo.shape.id,
    );

    if (relationship === "double-bound" && lAB < 30) {
      tempA.setTo(a);
      tempB.setTo(b);
      tempC.setTo(c);
    } else if (relationship === "safe") {
      if (startShapeInfo && !startShapeInfo.didIntersect) {
        tempA.setTo(a);
      }

      if (
        (endShapeInfo && !endShapeInfo.didIntersect) ||
        distFn(handle_aCA, aCA) > distFn(handle_aCA, aCB)
      ) {
        tempB
          .setTo(handleArc.center)
          .add(
            Vec.FromAngle(
              aCA +
                dAB *
                  (Math.min(0.9, (MIN_ARROW_LENGTH * shape.props.scale) / lAB) *
                    (isClockwise ? 1 : -1)),
            ).mul(handleArc.radius),
          );
      }
    }
  }

  placeCenterHandle(
    handleArc.center,
    handleArc.radius,
    tempA,
    tempB,
    tempC,
    handle_dAB,
    isClockwise,
  );

  if (tempA.equals(tempB)) {
    tempA.setTo(tempC.clone().addXY(1, 1));
    tempB.setTo(tempC.clone().subXY(1, 1));
  }

  a.setTo(tempA);
  b.setTo(tempB);
  c.setTo(tempC);
  const bodyArc = getArcInfo(a, b, c);

  return {
    bindings,
    isStraight: false,
    start: {
      point: a,
      handle: terminalsInArrowSpace.start,
      arrowhead: shape.props.arrowheadStart,
    },
    end: {
      point: b,
      handle: terminalsInArrowSpace.end,
      arrowhead: shape.props.arrowheadEnd,
    },
    middle: c,
    handleArc,
    bodyArc,
    isValid:
      bodyArc.length !== 0 &&
      isFinite(bodyArc.center.x) &&
      isFinite(bodyArc.center.y),
  };
}
function getArcInfo(a: VecLike, b: VecLike, c: VecLike): TLArcInfo {
  // find a circle from the three points
  const center = centerOfCircleFromThreePoints(a, b, c);

  const radius = Vec.Dist(center, a);

  // Whether to draw the arc clockwise or counter-clockwise (are the points clockwise?)
  const sweepFlag = +Vec.Clockwise(a, c, b);

  // The base angle of the arc in radians
  const ab = ((a.y - b.y) ** 2 + (a.x - b.x) ** 2) ** 0.5;
  const bc = ((b.y - c.y) ** 2 + (b.x - c.x) ** 2) ** 0.5;
  const ca = ((c.y - a.y) ** 2 + (c.x - a.x) ** 2) ** 0.5;

  const theta = Math.acos((bc * bc + ca * ca - ab * ab) / (2 * bc * ca)) * 2;

  // Whether to draw the long arc or short arc
  const largeArcFlag = +(PI > theta);

  // The size of the arc to draw in radians
  const size = (PI2 - theta) * (sweepFlag ? 1 : -1);

  // The length of the arc to draw in distance units
  const length = size * radius;

  return {
    center,
    radius,
    size,
    length,
    largeArcFlag,
    sweepFlag,
  };
}
function clockwiseAngleDist(a0: number, a1: number): number {
  a0 = canonicalizeRotation(a0);
  a1 = canonicalizeRotation(a1);
  if (a0 > a1) {
    a1 += PI2;
  }
  return a1 - a0;
}
function canonicalizeRotation(a: number) {
  a = a % PI2;
  if (a < 0) {
    a = a + PI2;
  } else if (a === 0) {
    // prevent negative zero
    a = 0;
  }
  return a;
}
function counterClockwiseAngleDist(a0: number, a1: number): number {
  return PI2 - clockwiseAngleDist(a0, a1);
}
const isSafeFloat = (n: number) => {
  return Math.abs(n) < Number.MAX_SAFE_INTEGER;
};
function intersectCirclePolyline(c: VecLike, r: number, points: VecLike[]) {
  const result: VecLike[] = [];
  let a: VecLike | undefined, b: VecLike | undefined, int: VecLike[] | null;

  for (let i = 1, n = points.length; i < n; i++) {
    a = points[i - 1];
    b = points[i];
    if (!a || !b) continue;
    int = intersectLineSegmentCircle(a, b, c, r);
    if (int) result.push(...int);
  }

  if (result.length === 0) return null; // no intersection

  return result;
}
function placeCenterHandle(
  center: VecLike,
  radius: number,
  tempA: Vec,
  tempB: Vec,
  tempC: Vec,
  originalArcLength: number,
  isClockwise: boolean,
) {
  const aCA = Vec.Angle(center, tempA); // angle center -> a
  const aCB = Vec.Angle(center, tempB); // angle center -> b
  let dAB = clockwiseAngleDist(aCA, aCB); // angle distance between a and b
  if (!isClockwise) dAB = PI2 - dAB;

  tempC
    .setTo(center)
    .add(Vec.FromAngle(aCA + dAB * (0.5 * (isClockwise ? 1 : -1))).mul(radius));

  if (dAB > originalArcLength) {
    tempC.rotWith(center, PI);
    const t = tempB.clone();
    tempB.setTo(tempA);
    tempA.setTo(t);
  }
}
function centerOfCircleFromThreePoints(a: VecLike, b: VecLike, c: VecLike) {
  const u =
    -2 * (a.x * (b.y - c.y) - a.y * (b.x - c.x) + b.x * c.y - c.x * b.y);
  return new Vec(
    ((a.x * a.x + a.y * a.y) * (c.y - b.y) +
      (b.x * b.x + b.y * b.y) * (a.y - c.y) +
      (c.x * c.x + c.y * c.y) * (b.y - a.y)) /
      u,
    ((a.x * a.x + a.y * a.y) * (b.x - c.x) +
      (b.x * b.x + b.y * b.y) * (c.x - a.x) +
      (c.x * c.x + c.y * c.y) * (a.x - b.x)) /
      u,
  );
}
