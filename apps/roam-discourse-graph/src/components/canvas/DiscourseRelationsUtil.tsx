import React from "react";
import {
  App as TldrawApp,
  TLBaseShape,
  TLArrowShapeProps,
  TLArrowUtil,
} from "@tldraw/tldraw";
import { COLOR_ARRAY, discourseContext } from "./Tldraw";

export type AddReferencedNodeType = Record<string, ReferenceFormatType[]>;
type ReferenceFormatType = {
  format: string;
  sourceName: string;
  sourceType: string;
  destinationType: string;
  destinationName: string;
};

export type DiscourseRelationShape = TLBaseShape<string, TLArrowShapeProps>;

// Helper to add referenced nodes to node titles
// EG: [[EVD]] - {content} - {Source}
// {Source} is a referenced node
export type DiscourseReferencedNodeShape = TLBaseShape<
  string,
  TLArrowShapeProps
>;
// @ts-ignore
export class DiscourseReferencedNodeUtil extends TLArrowUtil<DiscourseReferencedNodeShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color: COLOR_ARRAY[0],
      labelColor: COLOR_ARRAY[1],
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: "for",
      font: "mono" as const,
    };
  }
  render(shape: DiscourseReferencedNodeShape) {
    return (
      <>
        <style>{`#${shape.id.replace(":", "_")}_clip_0 {
  display: none;
}
[data-shape-type="${this.type}"] .rs-arrow-label {
  left: 0;
  top: 0;
  width: unset;
  height: unset;
}
`}</style>
        {super.render(shape)}
      </>
    );
  }
}
// @ts-ignore
export class DiscourseRelationUtil extends TLArrowUtil<DiscourseRelationShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    const relations = Object.values(discourseContext.relations);
    // TODO - add canvas settings to relations config
    const relationIndex = relations.findIndex((rs) =>
      rs.some((r) => r.id === this.type)
    );
    const isValid = relationIndex >= 0 && relationIndex < relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color,
      labelColor: color,
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: isValid
        ? Object.keys(discourseContext.relations)[relationIndex]
        : "",
      font: "mono" as const,
    };
  }
  override onBeforeCreate = (shape: DiscourseRelationShape) => {
    // TODO - propsForNextShape is clobbering our choice of color
    const relations = Object.values(discourseContext.relations);
    const relationIndex = relations.findIndex((rs) =>
      rs.some((r) => r.id === this.type)
    );
    const isValid = relationIndex >= 0 && relationIndex < relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      ...shape,
      props: {
        ...shape.props,
        color,
        labelColor: color,
      },
    };
  };
  render(shape: DiscourseRelationShape) {
    return (
      <>
        <style>{`#${shape.id.replace(":", "_")}_clip_0 {
  display: none;
}
[data-shape-type="${this.type}"] .rs-arrow-label {
  left: 0;
  top: 0;
  width: unset;
  height: unset;
}
`}</style>
        {super.render(shape)}
      </>
    );
  }
}
