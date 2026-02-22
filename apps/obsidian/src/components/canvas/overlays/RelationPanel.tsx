import { useEffect, useMemo, useState } from "react";
import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  buildDiscourseNodeShapeRecord,
  type DiscourseNodeShape,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import {
  ensureBlockRefForFile,
  resolveLinkedFileFromSrc,
  extractBlockRefId,
} from "~/components/canvas/stores/assetStore";
import { TLShapeId, createShapeId, useEditor } from "tldraw";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  createOrUpdateArrowBinding,
  getArrowBindings,
} from "~/components/canvas/utils/relationUtils";
import { getFrontmatterForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";
import { getRelationTypeById } from "~/utils/typeUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";
import { DEFAULT_TLDRAW_COLOR } from "~/utils/tldrawColors";
import {
  getNodeInstanceIdForFile,
  getRelationsForNodeInstanceId,
  getFileForNodeInstanceId,
  addRelation,
} from "~/utils/relationsStore";

type GroupedRelation = {
  key: string;
  label: string;
  isSource: boolean;
  relationTypeId: string;
  linkedFiles: TFile[];
};

type RelationFileItemProps = {
  file: TFile;
  group: GroupedRelation;
  checkExistingRelation: (
    targetFile: TFile,
    relationTypeId: string,
  ) => Promise<DiscourseRelationShape | null>;
  handleCreateRelationTo: (
    targetFile: TFile,
    relationTypeId: string,
    isSource: boolean,
  ) => Promise<void>;
  handleDeleteRelation: (
    targetFile: TFile,
    relationTypeId: string,
  ) => Promise<void>;
};

export type RelationsPanelProps = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  nodeShape: DiscourseNodeShape;
  onClose: () => void;
};

const RelationFileItem = ({
  file,
  group,
  checkExistingRelation,
  handleCreateRelationTo,
  handleDeleteRelation,
}: RelationFileItemProps) => {
  const [hasExistingRelation, setHasExistingRelation] = useState<
    boolean | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if relation exists when component mounts
  useEffect(() => {
    const checkRelation = async () => {
      try {
        const existingRelation = await checkExistingRelation(
          file,
          group.relationTypeId,
        );
        setHasExistingRelation(!!existingRelation);
      } catch (e) {
        console.error("Failed to check existing relation", e);
        setHasExistingRelation(false);
      }
    };
    void checkRelation();
  }, [file, group.relationTypeId, checkExistingRelation]);

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (hasExistingRelation) {
        await handleDeleteRelation(file, group.relationTypeId);
        setHasExistingRelation(false);
      } else {
        await handleCreateRelationTo(
          file,
          group.relationTypeId,
          group.isSource,
        );
        setHasExistingRelation(true);
      }
    } catch (e) {
      showToast({
        severity: "error",
        title: "Failed to Handle Relation Action",
        description: "Could not handle relation action",
        targetCanvasId: file.path,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonProps = () => {
    if (hasExistingRelation === null) {
      return {
        className:
          "ml-2 rounded bg-gray-300 px-2 py-0.5 text-xs text-white cursor-not-allowed",
        title: "Checking relation status...",
        disabled: true,
        children: "?",
      };
    }

    if (hasExistingRelation) {
      return {
        className:
          "ml-2 rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:bg-red-300",
        title: "Remove this relation from canvas",
        disabled: isLoading,
        children: "−",
      };
    }

    return {
      className:
        "ml-2 rounded bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600 disabled:bg-blue-300",
      title: "Add this relation to canvas",
      disabled: isLoading,
      children: "+",
    };
  };

  const buttonProps = getButtonProps();

  return (
    <li className="flex items-center gap-2">
      <a href="#" className="text-accent-text">
        {file.basename}
      </a>
      <button {...buttonProps} onClick={(e) => void handleButtonClick(e)} />
    </li>
  );
};

export const RelationsPanel = ({
  plugin,
  canvasFile,
  nodeShape,
  onClose,
}: RelationsPanelProps) => {
  const editor = useEditor();
  const [groups, setGroups] = useState<GroupedRelation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve the file from the shape's src
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const src = nodeShape.props.src ?? undefined;
        if (!src) {
          setGroups([]);
          setError("This node is not linked to a file.");
          return;
        }
        const file = await resolveLinkedFileFromSrc({
          app: plugin.app,
          canvasFile,
          src,
        });
        if (!file) {
          setGroups([]);
          setError("Linked file not found.");
          return;
        }
        const g = await computeRelations(plugin, file);
        setGroups(g);
      } catch (e) {
        showToast({
          severity: "error",
          title: "Failed to Load Relations",
          description: "Could not load relations",
          targetCanvasId: canvasFile.path,
        });
        setError("Failed to load relations.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [plugin, canvasFile, nodeShape.id, nodeShape.props.src, editor]);

  const headerTitle = useMemo(() => {
    return nodeShape.props.title || "Selected node";
  }, [nodeShape.props.title]);

  const ensureNodeShapeForFile = async (
    file: TFile,
  ): Promise<DiscourseNodeShape> => {
    // Try to find an existing node shape that points to this file via block ref
    const blockRef = await ensureBlockRefForFile({
      app: plugin.app,
      canvasFile,
      targetFile: file,
    });
    const shapes = editor.getCurrentPageShapes();
    const existing = shapes.find((s) => {
      if (s.type !== "discourse-node") return false;
      const src = (s as DiscourseNodeShape).props.src ?? "";
      return extractBlockRefId(src) === blockRef;
    }) as DiscourseNodeShape | undefined;

    if (existing) return existing;

    const newId = createShapeId();
    const src = `asset:obsidian.blockref.${blockRef}`;
    const x = nodeShape.x + nodeShape.props.w + 80;
    const y = nodeShape.y;
    const nodeTypeId = getFrontmatterForFile(plugin.app, file)
      ?.nodeTypeId as string;

    const created = buildDiscourseNodeShapeRecord(editor, {
      id: newId,
      x,
      y,
      props: {
        src,
        title: file.basename,
        nodeTypeId,
        size: "m",
        fontFamily: "sans",
      },
    });

    editor.createShape(created);
    return created;
  };

  // Check if a relation already exists between the selected node and a target file
  const checkExistingRelation = async (
    targetFile: TFile,
    relationTypeId: string,
  ): Promise<DiscourseRelationShape | null> => {
    try {
      // Get all shapes on the canvas
      const allShapes = editor.getCurrentPageShapes();

      // Find the target node shape that corresponds to the file
      const targetBlockRef = await ensureBlockRefForFile({
        app: plugin.app,
        canvasFile,
        targetFile,
      });
      const targetNodeShape = allShapes.find((shape) => {
        if (shape.type !== "discourse-node") return false;
        const src = (shape as DiscourseNodeShape).props.src ?? "";
        return extractBlockRefId(src) === targetBlockRef;
      }) as DiscourseNodeShape | undefined;

      if (!targetNodeShape) return null;

      // Find relation shapes that connect the selected node and target node
      const relationShapes = allShapes.filter(
        (shape) =>
          shape.type === "discourse-relation" &&
          (shape as DiscourseRelationShape).props.relationTypeId ===
            relationTypeId,
      ) as DiscourseRelationShape[];

      for (const relationShape of relationShapes) {
        const bindings = getArrowBindings(editor, relationShape);

        // Check if this relation connects our two nodes in ANY direction
        // The relation could exist as either:
        // 1. selectedNode -> targetNode (forward direction)
        // 2. targetNode -> selectedNode (reverse direction)
        const isConnectedForward =
          bindings.start?.toId === nodeShape.id &&
          bindings.end?.toId === targetNodeShape.id;

        const isConnectedReverse =
          bindings.start?.toId === targetNodeShape.id &&
          bindings.end?.toId === nodeShape.id;

        if (isConnectedForward || isConnectedReverse) {
          return relationShape;
        }
      }

      return null;
    } catch (e) {
      console.error("Failed to check existing relation", e);
      return null;
    }
  };

  const handleDeleteRelationShape = async (
    targetFile: TFile,
    relationTypeId: string,
  ) => {
    try {
      const existingRelation = await checkExistingRelation(
        targetFile,
        relationTypeId,
      );
      if (existingRelation) {
        editor.deleteShapes([existingRelation.id]);
      }
    } catch (e) {
      showToast({
        severity: "error",
        title: "Failed to Delete Relation",
        description: "Could not delete relation",
        targetCanvasId: canvasFile.path,
      });
      console.error("Failed to delete relation", e);
    }
  };

  const handleCreateRelationTo = async (
    targetFile: TFile,
    relationTypeId: string,
    isSource: boolean,
  ) => {
    try {
      const relationType = getRelationTypeById(plugin, relationTypeId);
      const relationLabel = relationType?.label ?? "";

      const currentFile = await resolveLinkedFileFromSrc({
        app: plugin.app,
        canvasFile,
        src: nodeShape.props.src ?? "",
      });
      if (!currentFile || !targetFile) return;

      const sourceFile = isSource ? currentFile : targetFile;
      const destFile = isSource ? targetFile : currentFile;
      const sourceId = await getNodeInstanceIdForFile(plugin, sourceFile);
      const destId = await getNodeInstanceIdForFile(plugin, destFile);
      if (!sourceId || !destId) {
        showToast({
          severity: "error",
          title: "Could Not Resolve Nodes",
          description:
            "Could not resolve node instance IDs for the selected files.",
          targetCanvasId: canvasFile.path,
        });
        return;
      }

      const targetNode = await ensureNodeShapeForFile(targetFile);

      const id: TLShapeId = createShapeId();

      // Determine source and destination nodes
      const sourceNode = isSource ? nodeShape : targetNode;
      const destNode = isSource ? targetNode : nodeShape;

      // Calculate connection points on the edges of the nodes
      const sourcePoint = {
        x: sourceNode.x + sourceNode.props.w,
        y: sourceNode.y + sourceNode.props.h / 2,
      };

      // Position the relation shape at the source point
      const shape: DiscourseRelationShape = {
        id,
        typeName: "shape",
        type: "discourse-relation",
        x: sourcePoint.x,
        y: sourcePoint.y,
        rotation: 0,
        index: editor.getHighestIndexForParent(editor.getCurrentPageId()),
        parentId: editor.getCurrentPageId(),
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          // Use defaults from DiscourseRelationUtil.getDefaultProps()
          dash: "draw",
          size: "m",
          fill: "none",
          color: relationType?.color ?? DEFAULT_TLDRAW_COLOR,
          labelColor: "black",
          bend: 0,
          // Will be updated by bindings
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          text: relationLabel,
          labelPosition: 0.5,
          font: "draw",
          scale: 1,
          kind: "arc",
          elbowMidPoint: 0,
          relationTypeId,
        },
      };

      editor.createShape(shape);

      // Create bindings using the proper utility function
      // This follows the same pattern as DiscourseRelationTool and onHandleDrag
      createOrUpdateArrowBinding(editor, shape, sourceNode.id, {
        terminal: "start",
        normalizedAnchor: { x: 1, y: 0.5 }, // Right edge of source node
        isPrecise: false,
        isExact: false,
        snap: "none",
      });

      createOrUpdateArrowBinding(editor, shape, destNode.id, {
        terminal: "end",
        normalizedAnchor: { x: 0, y: 0.5 }, // Left edge of dest node
        isPrecise: false,
        isExact: false,
        snap: "none",
      });

      const { id: relationInstanceId } = await addRelation(plugin, {
        type: relationTypeId,
        source: sourceId,
        destination: destId,
      });
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        meta: { ...shape.meta, relationInstanceId },
      });
    } catch (e) {
      console.error("Failed to create relation to file", e);
      showToast({
        severity: "error",
        title: "Failed to Create Relation",
        description: "Could not create relation to file",
        targetCanvasId: canvasFile.path,
      });
    }
  };

  return (
    <div className="min-w-80 max-w-md rounded-lg border bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Relations</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700">{headerTitle}</div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading relations...</div>
      ) : error ? (
        <div className="text-center text-red-600">{error}</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-500">No relations found.</div>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {groups.map((group) => (
            <li key={group.key} className="rounded border p-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {group.isSource ? "→" : "←"}
                </span>
                <span className="text-sm font-medium">{group.label}</span>
              </div>
              {group.linkedFiles.length === 0 ? (
                <div className="text-xs text-gray-500">None</div>
              ) : (
                <ul className="m-0 list-none space-y-1 p-0 pl-5">
                  {group.linkedFiles.map((f) => {
                    return (
                      <RelationFileItem
                        key={f.path}
                        file={f}
                        group={group}
                        checkExistingRelation={checkExistingRelation}
                        handleCreateRelationTo={handleCreateRelationTo}
                        handleDeleteRelation={handleDeleteRelationShape}
                      />
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const computeRelations = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): Promise<GroupedRelation[]> => {
  const fileCache = plugin.app.metadataCache.getFileCache(file);
  if (!fileCache?.frontmatter) return [];

  const activeNodeTypeId = fileCache.frontmatter.nodeTypeId as string;
  if (!activeNodeTypeId) return [];

  const nodeInstanceId = await getNodeInstanceIdForFile(plugin, file);
  if (!nodeInstanceId) return [];

  const relations = await getRelationsForNodeInstanceId(
    plugin,
    nodeInstanceId,
  );
  const result = new Map<string, GroupedRelation>();

  for (const relationType of plugin.settings.relationTypes) {
    const typeLevelRelation = plugin.settings.discourseRelations.find(
      (rel) =>
        (rel.sourceId === activeNodeTypeId ||
          rel.destinationId === activeNodeTypeId) &&
        rel.relationshipTypeId === relationType.id,
    );
    if (!typeLevelRelation) continue;

    const instanceRels = relations.filter((r) => r.type === relationType.id);
    const isSource = typeLevelRelation.sourceId === activeNodeTypeId;
    const label = isSource ? relationType.label : relationType.complement;
    const key = `${relationType.id}-${isSource}`;

    if (!result.has(key)) {
      result.set(key, {
        key,
        label,
        isSource,
        relationTypeId: relationType.id,
        linkedFiles: [],
      });
    }

    const group = result.get(key)!;
    for (const r of instanceRels) {
      const otherId = r.source === nodeInstanceId ? r.destination : r.source;
      const linked = await getFileForNodeInstanceId(plugin, otherId);
      if (linked && !group.linkedFiles.some((f) => f.path === linked.path)) {
        group.linkedFiles.push(linked);
      }
    }
  }

  return Array.from(result.values());
};
