import { useEffect, useMemo, useState } from "react";
import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import { ensureBlockRefForFile, resolveLinkedFileFromSrc, extractBlockRefId, resolveLinkedTFileByBlockRef } from "~/components/canvas/stores/assetStore";
import { Editor, TLShapeId, createBindingId, createShapeId, useEditor } from "tldraw";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";

type GroupedRelation = {
  key: string;
  label: string;
  isSource: boolean;
  relationTypeId: string;
  linkedFiles: TFile[];
};

export interface RelationsPanelProps {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  nodeShape: DiscourseNodeShape;
  onClose: () => void;
}

export const RelationsPanel = ({
  plugin,
  canvasFile,
  nodeShape,
  onClose,
}: RelationsPanelProps) => {
  const editor = useEditor();
  const [linkedFile, setLinkedFile] = useState<TFile | null>(null);
  const [groups, setGroups] = useState<GroupedRelation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [presentPaths, setPresentPaths] = useState<Set<string>>(new Set());

  // Resolve the file from the shape's src
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const src = nodeShape.props.src ?? undefined;
        if (!src) {
          setLinkedFile(null);
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
          setLinkedFile(null);
          setGroups([]);
          setError("Linked file not found.");
          return;
        }
        setLinkedFile(file);
        const g = computeRelations(plugin, file);
        setGroups(g);
        // After computing relations for the active file, compute presence map for all links on the canvas
        const presence = await computePresenceMap(plugin, canvasFile, editor);
        setPresentPaths(presence);
      } catch (e) {
        console.error(e);
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

  const ensureNodeShapeForFile = async (file: TFile): Promise<DiscourseNodeShape> => {
    // Try to find an existing node shape that points to this file via block ref
    const blockRef = await ensureBlockRefForFile(plugin.app, canvasFile, file);
    const shapes = editor.getCurrentPageShapes();
    const existing = shapes.find((s) => {
      if (s.type !== "discourse-node") return false;
      const src = (s as DiscourseNodeShape).props.src ?? "";
      return extractBlockRefId(src) === blockRef;
    }) as DiscourseNodeShape | undefined;

    if (existing) return existing;

    // Create a new node shape near the selected node
    const newId = createShapeId();
    const src = `asset:obsidian.blockref.${blockRef}`;
    const x = nodeShape.x + nodeShape.props.w + 80;
    const y = nodeShape.y;

    const created: DiscourseNodeShape = {
      id: newId,
      typeName: "shape",
      type: "discourse-node",
      x,
      y,
      rotation: 0,
      index: editor.getHighestIndexForParent(editor.getCurrentPageId()),
      parentId: editor.getCurrentPageId(),
      isLocked: false,
      opacity: 1,
      meta: {},
      props: {
        w: 200,
        h: 100,
        src,
        title: file.basename,
        nodeTypeId: "",
      },
    };

    editor.createShape(created);
    return created;
  };

  const handleCreateRelationTo = async (
    targetFile: TFile,
    relationTypeId: string,
    isSource: boolean,
  ) => {
    try {
      const targetNode = await ensureNodeShapeForFile(targetFile);
      const relationLabel = plugin.settings.relationTypes.find((t) => t.id === relationTypeId)?.label ?? "";

      const id: TLShapeId = createShapeId();
      const startPoint = isSource
        ? { x: nodeShape.x + nodeShape.props.w, y: nodeShape.y + nodeShape.props.h / 2 }
        : { x: targetNode.x + targetNode.props.w, y: targetNode.y + targetNode.props.h / 2 };
      const endPoint = isSource
        ? { x: targetNode.x, y: targetNode.y + targetNode.props.h / 2 }
        : { x: nodeShape.x, y: nodeShape.y + nodeShape.props.h / 2 };

      // Convert page coordinates to local shape coordinates by positioning the shape at the
      // top-left of the segment's bounding box
      const minX = Math.min(startPoint.x, endPoint.x);
      const minY = Math.min(startPoint.y, endPoint.y);
      const localStart = { x: startPoint.x - minX, y: startPoint.y - minY };
      const localEnd = { x: endPoint.x - minX, y: endPoint.y - minY };

      const shape: DiscourseRelationShape = {
        id,
        typeName: "shape",
        type: "discourse-relation",
        x: minX,
        y: minY,
        rotation: 0,
        index: editor.getHighestIndexForParent(editor.getCurrentPageId()),
        parentId: editor.getCurrentPageId(),
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          // defaults similar to getDefaultProps
          dash: "draw",
          size: "m",
          fill: "none",
          color: "blue",
          labelColor: "blue",
          bend: 0,
          start: localStart,
          end: localEnd,
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

      // Create arrow bindings to source and target nodes
      const sourceNode = isSource ? nodeShape : targetNode;
      const destNode = isSource ? targetNode : nodeShape;

      const startBinding = {
        id: createBindingId(),
        type: "arrow" as const,
        fromId: shape.id,
        toId: sourceNode.id,
        props: {
          terminal: "start" as const,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      };

      const endBinding = {
        id: createBindingId(),
        type: "arrow" as const,
        fromId: shape.id,
        toId: destNode.id,
        props: {
          terminal: "end" as const,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      };

      console.log("startBinding", startBinding);
      console.log("endBinding", endBinding);

      editor.createBindings([startBinding, endBinding]);

      // Tell the arrow to use bindings for its terminals so it follows the nodes
      editor.updateShape({
        id: shape.id,
        type: "discourse-relation",
        props: {
          ...shape.props,
          start: {
            type: "binding",
            boundShapeId: sourceNode.id,
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
          },
          end: {
            type: "binding",
            boundShapeId: destNode.id,
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
          },
        },
      });
    } catch (e) {
      console.error("Failed to create relation to file", e);
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
        <div className="text-xs text-gray-500">
          {linkedFile ? linkedFile.basename : "(unlinked)"}
        </div>
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
                    const present = presentPaths.has(f.path);
                    return (
                      <li key={f.path} className="flex items-center gap-2">
                        <span
                          className={
                            present
                              ? "flex h-5 w-5 items-center justify-center rounded bg-green-500 text-white"
                              : "flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white"
                          }
                          title={present ? "Node present on canvas" : "Node not on canvas"}
                        >
                          {present ? "+" : "−"}
                        </span>
                        <a href="#" className="text-accent-text">
                          {f.basename}
                        </a>
                        <button
                          className="ml-2 rounded bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
                          title="Create relation to this node"
                          onClick={(e) => {
                            e.preventDefault();
                            void handleCreateRelationTo(f, group.relationTypeId, group.isSource);
                          }}
                        >
                          +
                        </button>
                      </li>
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
}

const computeRelations = (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): GroupedRelation[] => {
  const fileCache = plugin.app.metadataCache.getFileCache(file);
  if (!fileCache?.frontmatter) return [];

  const activeNodeTypeId = fileCache.frontmatter.nodeTypeId;
  if (!activeNodeTypeId) return [];

  const result = new Map<string, GroupedRelation>();

  for (const relationType of plugin.settings.relationTypes) {
    const frontmatterLinks = fileCache.frontmatter[relationType.id];
    if (!frontmatterLinks) continue;

    const links = Array.isArray(frontmatterLinks)
      ? frontmatterLinks
      : [frontmatterLinks];

    const relation = plugin.settings.discourseRelations.find(
      (rel) =>
        (rel.sourceId === activeNodeTypeId ||
          rel.destinationId === activeNodeTypeId) &&
        rel.relationshipTypeId === relationType.id,
    );
    if (!relation) continue;

    const isSource = relation.sourceId === activeNodeTypeId;
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

    for (const link of links) {
      const match = String(link).match(/\[\[(.*?)\]\]/);
      if (!match) continue;
      const linkedFileName = match[1] ?? "";
      const linked = plugin.app.metadataCache.getFirstLinkpathDest(
        linkedFileName,
        file.path,
      );
      if (!linked) continue;

      const group = result.get(key)!;
      if (!group.linkedFiles.some((f) => f.path === linked.path)) {
        group.linkedFiles.push(linked);
      }
    }
  }

  return Array.from(result.values());
};

// Build a set of file paths that are already present on the canvas as discourse nodes
const computePresenceMap = async (
  plugin: DiscourseGraphPlugin,
  canvasFile: TFile,
  editor: Editor,
): Promise<Set<string>> => {
  try {
    const fileCache = plugin.app.metadataCache.getFileCache(canvasFile);
    const blockEntries = Object.entries(fileCache?.blocks ?? {});

    // Map file path -> set of block ids that reference it
    const fileToBlockIds = new Map<string, Set<string>>();
    for (const [blockId] of blockEntries) {
      const linked = await resolveLinkedTFileByBlockRef(
        plugin.app,
        canvasFile,
        blockId,
      );
      if (!linked) continue;
      const set = fileToBlockIds.get(linked.path) ?? new Set<string>();
      set.add(blockId);
      fileToBlockIds.set(linked.path, set);
    }

    // Gather block ids currently used by discourse-node shapes on the canvas
    const shapes = editor.getCurrentPageShapes();
    const usedBlockIds = new Set<string>();
    for (const shape of shapes) {
      if (shape.type !== "discourse-node") continue;
      const src = (shape as DiscourseNodeShape).props?.src ?? "";
      const blockId = extractBlockRefId(src);
      if (blockId) usedBlockIds.add(blockId);
    }

    // Any file that has at least one block id used by a node is present
    const presentPaths = new Set<string>();
    for (const [filePath, blockIds] of fileToBlockIds) {
      for (const id of blockIds) {
        if (usedBlockIds.has(id)) {
          presentPaths.add(filePath);
          break;
        }
      }
    }
    return presentPaths;
  } catch (e) {
    console.error("Failed to compute canvas presence map", e);
    return new Set();
  }
};
