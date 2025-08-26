import {
  ShapeUtil,
  HTMLContainer,
  TLBaseShape,
  arrowShapeProps,
  RecordPropsType,
  T,
  Geometry2d,
  Edge2d,
  Vec,
  Group2d,
  Rectangle2d,
  Arc2d,
  SVGContainer,
  TLShapeUtilCanBindOpts,
  Editor,
  TLShapeId,
} from "tldraw";
import type { App, TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import { DiscourseRelationType } from "~/types";

// Use arrow shape props directly like Roam does
export type DiscourseRelationShapeProps = RecordPropsType<typeof arrowShapeProps> & {
  // Additional discourse-specific properties
  relationTypeId: string;
};

export type DiscourseRelationShape = TLBaseShape<
  "discourse-relation",
  DiscourseRelationShapeProps
>;

export type DiscourseRelationUtilOptions = {
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

export class DiscourseRelationUtil extends ShapeUtil<DiscourseRelationShape> {
  static type = "discourse-relation" as const;
  static props = {
    ...arrowShapeProps,
    relationTypeId: T.string,
  };
  
  declare options: DiscourseRelationUtilOptions;

  // Utility flags similar to Roam implementation
  override canEdit = () => true;
  override canSnap = () => false;
  override hideResizeHandles = () => true;
  override hideRotateHandle = () => true;
  override hideSelectionBoundsBg = () => true;
  override hideSelectionBoundsFg = () => true;

  override canBind({
    toShapeType,
  }: TLShapeUtilCanBindOpts<DiscourseRelationShape>): boolean {
    // Can bind to discourse nodes but not to other arrows
    return toShapeType === "discourse-node";
  }

  getDefaultProps(): DiscourseRelationShape["props"] {
    return {
      // Standard arrow props
      dash: "draw",
      size: "m",
      fill: "none",
      color: "blue",
      labelColor: "blue",
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      text: "",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
      // Missing arrow props
      kind: "arc",
      elbowMidPoint: 0,
      // Discourse-specific props
      relationTypeId: "",
    };
  }

  getGeometry(shape: DiscourseRelationShape): Geometry2d {
    const { start, end, bend } = shape.props;
    
    // Create geometry similar to Roam's approach
    const bodyGeom = bend === 0
      ? new Edge2d({
          start: Vec.From(start),
          end: Vec.From(end),
        })
      : new Arc2d({
          center: Vec.From({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }),
          start: Vec.From(start),
          end: Vec.From(end),
          sweepFlag: bend > 0 ? 1 : 0,
          largeArcFlag: 0,
        });

    // Add label geometry if text exists
    let labelGeom;
    if (shape.props.text.trim()) {
      const midPoint = Vec.Med(Vec.From(start), Vec.From(end));
      labelGeom = new Rectangle2d({
        x: midPoint.x - 50,
        y: midPoint.y - 10,
        width: 100,
        height: 20,
        isFilled: true,
        isLabel: true,
      });
    }

    return new Group2d({
      children: [bodyGeom, ...(labelGeom ? [labelGeom] : [])],
    });
  }

  component(shape: DiscourseRelationShape) {
    const { start, end, text, color, labelColor, font, bend } = shape.props;
    const showLabel = text.trim().length > 0;
    
    // Calculate midpoint for label
    const midPoint = Vec.Med(Vec.From(start), Vec.From(end));
    
    return (
      <>
        <SVGContainer id={shape.id} style={{ minWidth: 50, minHeight: 50 }}>
          <svg>
            <defs>
              <marker
                id={`arrowhead-${shape.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={color}
                />
              </marker>
            </defs>
            
            {bend === 0 ? (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={color}
                strokeWidth={2}
                markerEnd={`url(#arrowhead-${shape.id})`}
              />
            ) : (
              <path
                d={`M ${start.x} ${start.y} Q ${midPoint.x + bend} ${midPoint.y} ${end.x} ${end.y}`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                markerEnd={`url(#arrowhead-${shape.id})`}
              />
            )}
          </svg>
        </SVGContainer>
        
        {showLabel && (
          <HTMLContainer
            style={{
              position: "absolute",
              left: midPoint.x - 50,
              top: midPoint.y - 10,
              width: 100,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "12px",
                color: labelColor,
                fontFamily: font === "mono" ? "monospace" : "sans-serif",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {text}
            </div>
          </HTMLContainer>
        )}
      </>
    );
  }

  indicator(shape: DiscourseRelationShape) {
    const { start, end } = shape.props;
    return (
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="transparent"
        strokeWidth={8}
      />
    );
  }

  getRelationType(
    shape: DiscourseRelationShape,
  ): DiscourseRelationType | null {
    // TODO: create a helper function to get the relation type from the id
    const relationType = this.options.plugin.settings.relationTypes.find(
      (type) => type.id === shape.props.relationTypeId,
    );
    return relationType || null;
  }

  // Method to check if this relation already exists between two nodes
  // This is a simplified check - in a full implementation, this would use tldraw's binding system
  relationExists(
    editor: any,
    sourceNodeId: string,
    destinationNodeId: string,
    relationTypeId: string,
  ): boolean {
    const shapes = editor.getCurrentPageShapes();
    
    return shapes.some((shape: any) => {
      if (shape.type !== "discourse-relation") return false;
      const relationShape = shape as DiscourseRelationShape;
      
      // For now, we just check if the relation type matches
      // In a full implementation, this would check if the shape is bound to the specific nodes
      return relationShape.props.relationTypeId === relationTypeId;
    });
  }

  // Method to create a relation between two discourse nodes
  createRelation =({
    editor,
    relationTypeId,
    relationLabel,
    startPoint = { x: 0, y: 0 },
    endPoint = { x: 100, y: 0 },
  }: {
    editor: Editor;
    relationTypeId: string;
    relationLabel: string;
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
  }): DiscourseRelationShape =>  {
    const id = window.crypto.randomUUID();
    const shape: DiscourseRelationShape = {
      id: id as TLShapeId,
      typeName: "shape",
      type: "discourse-relation",
      x: 0,
      y: 0,
      rotation: 0,
      index: editor.getHighestIndexForParent(editor.getCurrentPageId()),
      parentId: editor.getCurrentPageId(),
      isLocked: false,
      opacity: 1,
      meta: {},
      props: {
        ...DiscourseRelationUtil.prototype.getDefaultProps(),
        relationTypeId,
        text: relationLabel,
        start: startPoint,
        end: endPoint,
      },
    };

    editor.createShape(shape);
    return shape;
  }
}
