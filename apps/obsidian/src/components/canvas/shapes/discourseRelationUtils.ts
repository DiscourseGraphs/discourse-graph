import type { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { DiscourseRelationType } from "~/types";
import {
  DiscourseRelationShape,
  DiscourseRelationUtil,
} from "./DiscourseRelationShape";
import { DiscourseNodeShape } from "./DiscourseNodeShape";

export type RelationCanvasContext = {
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  editor: any;
};

export type CanvasRelation = {
  id: string;
  relationTypeId: string;
  sourceNodeId: string;
  destinationNodeId: string;
  relationLabel: string;
  exists: boolean; // Whether this relation already exists on the canvas
};

/**
 * Utility functions for managing discourse relations on the canvas
 */
export class DiscourseRelationManager {
  private context: RelationCanvasContext;

  constructor(context: RelationCanvasContext) {
    this.context = context;
  }

  /**
   * Get all available relation types for a given node type
   */
  getAvailableRelationTypes(nodeTypeId: string): DiscourseRelationType[] {
    const { plugin } = this.context;
    const availableRelationTypeIds = new Set<string>();

    // Find all relations where this node type can be source or destination
    plugin.settings.discourseRelations.forEach((relation) => {
      if (
        relation.sourceId === nodeTypeId ||
        relation.destinationId === nodeTypeId
      ) {
        availableRelationTypeIds.add(relation.relationshipTypeId);
      }
    });

    // Return the actual relation type objects
    return plugin.settings.relationTypes.filter((relationType) =>
      availableRelationTypeIds.has(relationType.id),
    );
  }

  /**
   * Get all possible relations for a discourse node shape
   */
  getPossibleRelations(
    nodeShape: DiscourseNodeShape,
  ): CanvasRelation[] {
    const { plugin } = this.context;
    const nodeTypeId = nodeShape.props.nodeTypeId;
    
    if (!nodeTypeId) return [];

    const relations: CanvasRelation[] = [];
    const existingRelations = this.getExistingCanvasRelations();

    // Find all discourse relations that involve this node type
    plugin.settings.discourseRelations.forEach((relation) => {
      if (
        relation.sourceId === nodeTypeId ||
        relation.destinationId === nodeTypeId
      ) {
        const relationType = plugin.settings.relationTypes.find(
          (rt) => rt.id === relation.relationshipTypeId,
        );

        if (!relationType) return;

        // Determine the target node type
        const targetNodeTypeId =
          relation.sourceId === nodeTypeId
            ? relation.destinationId
            : relation.sourceId;

        // Find all canvas nodes of the target type
        const targetNodes = this.getDiscourseNodeShapesByType(targetNodeTypeId);

        targetNodes.forEach((targetNode) => {
          const relationId = `${nodeShape.id}-${targetNode.id}-${relation.relationshipTypeId}`;
          // Check if this exact relation already exists on canvas
          const exists = existingRelations.some(
            (er) =>
              er.props.relationTypeId === relation.relationshipTypeId &&
              this.isShapeConnectedToNodes(er, nodeShape.id, targetNode.id),
          );

          relations.push({
            id: relationId,
            relationTypeId: relation.relationshipTypeId,
            sourceNodeId: nodeShape.id,
            destinationNodeId: targetNode.id,
            relationLabel: relationType.label,
            exists,
          });
        });
      }
    });

    return relations;
  }

  /**
   * Get all existing discourse relation shapes on the canvas
   */
  getExistingCanvasRelations(): DiscourseRelationShape[] {
    const { editor } = this.context;
    const shapes = editor.getCurrentPageShapes();
    return shapes.filter(
      (shape: any) => shape.type === "discourse-relation",
    ) as DiscourseRelationShape[];
  }

  /**
   * Get all discourse node shapes of a specific type
   */
  getDiscourseNodeShapesByType(nodeTypeId: string): DiscourseNodeShape[] {
    const { editor } = this.context;
    const shapes = editor.getCurrentPageShapes();
    return shapes.filter(
      (shape: any) =>
        shape.type === "discourse-node" &&
        shape.props.nodeTypeId === nodeTypeId,
    ) as DiscourseNodeShape[];
  }

  /**
   * Create a new relation shape between two discourse nodes
   */
  createRelation(
    sourceNode: DiscourseNodeShape,
    targetNode: DiscourseNodeShape,
    relationTypeId: string,
  ): DiscourseRelationShape | null {
    const { plugin, editor } = this.context;

    // Validate that this relation is allowed
    const isValidRelation = plugin.settings.discourseRelations.some(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        ((relation.sourceId === sourceNode.props.nodeTypeId &&
          relation.destinationId === targetNode.props.nodeTypeId) ||
          (relation.sourceId === targetNode.props.nodeTypeId &&
            relation.destinationId === sourceNode.props.nodeTypeId)),
    );

    if (!isValidRelation) {
      console.error("Invalid relation type for these node types");
      return null;
    }

    // Check if relation already exists
    const existingRelation = this.getExistingCanvasRelations().find(
      (rel) =>
        rel.props.relationTypeId === relationTypeId &&
        this.isShapeConnectedToNodes(rel, sourceNode.id, targetNode.id),
    );

    if (existingRelation) {
      console.warn("Relation already exists");
      return existingRelation;
    }

    // Get relation type info
    const relationType = plugin.settings.relationTypes.find(
      (rt) => rt.id === relationTypeId,
    );

    if (!relationType) {
      console.error("Relation type not found");
      return null;
    }

    // Calculate positions for the relation endpoints
    const sourceCenter = { x: sourceNode.x + 100, y: sourceNode.y + 50 }; // Approximate center
    const targetCenter = { x: targetNode.x + 100, y: targetNode.y + 50 }; // Approximate center

    // Create the relation shape
    const relationShape = DiscourseRelationUtil.createRelation(
      editor,
      relationTypeId,
      relationType.label,
      sourceCenter,
      targetCenter,
    );

    // TODO: Implement proper binding to nodes (requires tldraw binding system)
    // this.bindRelationToNodes(relationShape, sourceNode, targetNode);

    return relationShape;
  }

  /**
   * Delete a relation shape from the canvas
   */
  deleteRelation(relationShape: DiscourseRelationShape): void {
    const { editor } = this.context;
    
    // Remove any bindings first
    const bindings = editor.getBindingsFromShape(relationShape);
    bindings.forEach((binding: any) => {
      editor.deleteBinding(binding);
    });

    // Delete the shape
    editor.deleteShape(relationShape.id);
  }

  /**
   * Bind a relation shape to its source and target nodes
   */
  private bindRelationToNodes(
    relationShape: DiscourseRelationShape,
    sourceNode: DiscourseNodeShape,
    targetNode: DiscourseNodeShape,
  ): void {
    const { editor } = this.context;

    try {
      // Create binding from relation start to source node
      const startBinding = {
        id: editor.createId(),
        type: "arrow",
        fromId: relationShape.id,
        toId: sourceNode.id,
        props: {
          terminal: "start",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      };

      // Create binding from relation end to target node
      const endBinding = {
        id: editor.createId(),
        type: "arrow",
        fromId: relationShape.id,
        toId: targetNode.id,
        props: {
          terminal: "end",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      };

      editor.createBindings([startBinding, endBinding]);

      // Update the relation shape with binding information
      editor.updateShape({
        id: relationShape.id,
        type: "discourse-relation",
        props: {
          ...relationShape.props,
          start: {
            type: "binding",
            boundShapeId: sourceNode.id,
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
          },
          end: {
            type: "binding",
            boundShapeId: targetNode.id,
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
          },
        },
      });
    } catch (error) {
      console.error("Failed to bind relation to nodes:", error);
    }
  }

  /**
   * Helper method to check if a relation shape is connected to specific nodes
   * In the future, this should use tldraw's binding system
   */
  private isShapeConnectedToNodes(
    relationShape: DiscourseRelationShape,
    nodeId1: string,
    nodeId2: string,
  ): boolean {
    // For now, we'll check based on proximity to the relation endpoints
    // In a proper implementation, this would use tldraw bindings
    const { editor } = this.context;
    const node1 = editor.getShape(nodeId1 as any);
    const node2 = editor.getShape(nodeId2 as any);
    
    if (!node1 || !node2) return false;
    
    const { start, end } = relationShape.props;
    const node1Center = { x: node1.x + 100, y: node1.y + 50 };
    const node2Center = { x: node2.x + 100, y: node2.y + 50 };
    
    // Check if start/end points are close to the node centers
    const threshold = 50; // pixels
    const startToNode1 = Math.hypot(start.x - node1Center.x, start.y - node1Center.y);
    const endToNode2 = Math.hypot(end.x - node2Center.x, end.y - node2Center.y);
    const startToNode2 = Math.hypot(start.x - node2Center.x, start.y - node2Center.y);
    const endToNode1 = Math.hypot(end.x - node1Center.x, end.y - node1Center.y);
    
    return (
      (startToNode1 < threshold && endToNode2 < threshold) ||
      (startToNode2 < threshold && endToNode1 < threshold)
    );
  }

  /**
   * Get relations for a specific node that exist in the canvas
   */
  getNodeCanvasRelations(nodeShape: DiscourseNodeShape): DiscourseRelationShape[] {
    const existingRelations = this.getExistingCanvasRelations();
    return existingRelations.filter((relation) =>
      this.isShapeConnectedToNodes(relation, nodeShape.id, nodeShape.id), // This will need refinement
    );
  }

  /**
   * Check if a specific relation exists between two nodes
   */
  relationExistsBetweenNodes(
    sourceNodeId: string,
    targetNodeId: string,
    relationTypeId: string,
  ): boolean {
    const existingRelations = this.getExistingCanvasRelations();
    return existingRelations.some(
      (relation) =>
        relation.props.relationTypeId === relationTypeId &&
        this.isShapeConnectedToNodes(relation, sourceNodeId, targetNodeId),
    );
  }
}
