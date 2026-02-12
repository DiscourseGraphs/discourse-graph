import type { App, TFile } from "obsidian";
import type { Editor } from "tldraw";
import type DiscourseGraphPlugin from "~/index";
import { createShapeId } from "tldraw";
import { addWikilinkBlockrefForFile } from "~/components/canvas/stores/assetStore";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";
import { showToast } from "./toastUtils";
import { getFirstImageSrcForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";

type HandleDropOptions = {
  editor: Editor;
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  event: DragEvent;
};

/**
 * Check if a file is a Discourse Node by verifying it has a nodeTypeId in frontmatter
 */
export const isDiscourseNode = (app: App, file: TFile): boolean => {
  const fileCache = app.metadataCache.getFileCache(file);
  const nodeTypeId = fileCache?.frontmatter?.nodeTypeId;
  return typeof nodeTypeId === "string" && nodeTypeId.length > 0;
};

/**
 * Extract file path from dropped data
 * Obsidian drag-and-drop provides file paths in various formats
 */
const extractFilePathFromDragData = (
  event: DragEvent,
): string | null => {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return null;

  // Try to get plain text data (usually contains wikilink or file path)
  const textData = dataTransfer.getData("text/plain");
  if (!textData) return null;

  // Handle wikilink format [[filename]]
  const wikilinkMatch = textData.match(/\[\[([^\]]+)\]\]/);
  if (wikilinkMatch) {
    return wikilinkMatch[1] ?? null;
  }

  // Handle plain file path
  if (textData.endsWith(".md")) {
    return textData;
  }

  return textData;
};

/**
 * Handle drop events on the canvas to create DiscourseNodeShapes from dragged files
 */
export const handleCanvasDrop = async ({
  editor,
  app,
  plugin,
  canvasFile,
  event,
}: HandleDropOptions): Promise<void> => {
  try {
    const filePath = extractFilePathFromDragData(event);
    if (!filePath) return;

    // Resolve the file from the path
    const file = app.metadataCache.getFirstLinkpathDest(filePath, canvasFile.path);
    if (!file) {
      console.log("Could not resolve file from drag data:", filePath);
      return;
    }

    // Check if it's a Discourse Node
    if (!isDiscourseNode(app, file)) {
      console.log("Dropped file is not a Discourse Node:", file.path);
      return;
    }

    // Prevent default handling
    event.preventDefault();
    event.stopPropagation();

    // Get the drop position in canvas coordinates
    const canvasRect = editor.getContainer().getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top,
    };
    
    const pagePoint = editor.screenToPage(screenPoint);

    // Get node metadata
    const fileCache = app.metadataCache.getFileCache(file);
    const nodeTypeId = fileCache?.frontmatter?.nodeTypeId as string;
    const nodeType = plugin.settings.nodeTypes.find(
      (nt) => nt.id === nodeTypeId,
    );

    if (!nodeType) {
      showToast({
        severity: "warning",
        title: "Unknown Node Type",
        description: `Node type ID "${nodeTypeId}" not found`,
        targetCanvasId: canvasFile.path,
      });
      return;
    }

    // Create block reference for the file
    const src = await addWikilinkBlockrefForFile({
      app,
      canvasFile,
      linkedFile: file,
    });

    // Get image if node type supports it
    let imageSrc: string | undefined;
    if (nodeType.keyImage) {
      const img = await getFirstImageSrcForFile(app, file);
      if (img) {
        imageSrc = img;
      }
    }

    // Calculate size based on content
    const { w, h } = await calcDiscourseNodeSize({
      title: file.basename,
      nodeTypeId,
      imageSrc,
      plugin,
    });

    // Create the DiscourseNodeShape
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: "discourse-node",
      x: pagePoint.x - w / 2, // Center on drop point
      y: pagePoint.y - h / 2,
      props: {
        w,
        h,
        src,
        title: file.basename,
        nodeTypeId,
        imageSrc,
      },
    });

    editor.setSelectedShapes([shapeId]);
    editor.markHistoryStoppingPoint("create discourse node from drop");

    showToast({
      severity: "success",
      title: "Node Added",
      description: `Added ${nodeType.name}: ${file.basename}`,
      targetCanvasId: canvasFile.path,
    });
  } catch (error) {
    console.error("Error handling canvas drop:", error);
    showToast({
      severity: "error",
      title: "Drop Failed",
      description: `Could not create node from dropped file: ${error instanceof Error ? error.message : "Unknown error"}`,
      targetCanvasId: canvasFile.path,
    });
  }
};
