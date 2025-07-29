import { BaseBoxShapeUtil, Rectangle2d, ShapeUtil, T, TLBaseShape } from "tldraw";
import { TFile } from "obsidian";
import * as React from 'react';

// Define the shape's properties
export type DiscourseNodeShape = TLBaseShape<
  'discourse-node',
  {
    w: number;
    h: number;
    text: string;
    filePath: string; // Path to the file in vault
    nodeType: string; // Type of discourse node
    backgroundColor: string;
  }
>;

// Define the shape util class
export class DiscourseNodeUtil extends ShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;
  getGeometry(shape: DiscourseNodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  // Define the shape's properties for validation
  static props = {
    w: T.number,
    h: T.number,
    text: T.string,
    filePath: T.string,
    nodeType: T.string,
    backgroundColor: T.string,
  };

  // Default properties when creating a new shape
  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      text: "New Discourse Node",
      filePath: "",
      nodeType: "default",
      backgroundColor: "#efefef",
    };
  }

  component(shape: DiscourseNodeShape) {
    return React.createElement('div', null, shape.props.text);
  }

  indicator(shape: DiscourseNodeShape) {
    return React.createElement('rect', { width: shape.props.w, height: shape.props.h });
  }
}