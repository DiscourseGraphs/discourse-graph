import { Editor, TLShape, createShapeId, TLAssetId, TLTextShape } from "tldraw";
import type { TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import DiscourseGraphPlugin from "~/index";
import { createDiscourseNode } from "~/utils/createNode";
import {
  addWikilinkBlockrefForFile,
  extractBlockRefId,
  resolveLinkedTFileByBlockRef,
} from "~/components/canvas/stores/assetStore";
import { showToast } from "./toastUtils";
import { CreateNodeModal } from "~/components/CreateNodeModal";

type ConvertToDiscourseNodeArgs = {
  editor: Editor;
  shape: TLShape;
  nodeType: DiscourseNode;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

/**
 * Extracts text content from a text shape
 */
const getTextShapeContent = (shape: TLTextShape): string => {
  console.log("shape", shape);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return shape.props.richText.content[0].content[0].text;
};

/**
 * Gets the image file from an image shape
 */
const getImageFileFromShape = async ({
  shape,
  editor,
  plugin,
  canvasFile,
}: {
  shape: TLShape;
  editor: Editor;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
}): Promise<TFile | null> => {
  if (shape.type !== "image") return null;

  try {
    // Get the asset ID from the image shape
    const assetId = "assetId" in shape.props ? (shape.props.assetId as TLAssetId) : null;
    if (!assetId) return null;

    // Get the asset from the editor
    const asset = editor.getAsset(assetId);
    if (!asset) return null;

    // Extract the blockref from the asset src
    const src = asset.props.src;
    if (!src) return null;

    const blockRefId = extractBlockRefId(src);
    if (!blockRefId) return null;

    // Resolve the linked file
    const canvasFileCache = plugin.app.metadataCache.getFileCache(canvasFile);
    if (!canvasFileCache) return null;

    return await resolveLinkedTFileByBlockRef({
      app: plugin.app,
      canvasFile,
      blockRefId,
      canvasFileCache,
    });
  } catch (error) {
    console.error("Error getting image file from shape:", error);
    return null;
  }
};

/**
 * Converts a text shape to a discourse node
 */
const convertTextShapeToNode = async ({
  editor,
  shape,
  nodeType,
  plugin,
  canvasFile,
}: ConvertToDiscourseNodeArgs): Promise<void> => {
  const text = getTextShapeContent(shape as TLTextShape);
  
  if (!text.trim()) {
    showToast({
      severity: "warning",
      title: "Cannot Convert",
      description: "Text shape has no content to convert",
      targetCanvasId: canvasFile.path,
    });
    return;
  }

  // Create the discourse node file
  const createdFile = await createDiscourseNode({
    plugin,
    nodeType,
    text: text.trim(),
  });

  if (!createdFile) {
    throw new Error("Failed to create discourse node file");
  }

  // Create the discourse node shape
  await createDiscourseNodeShape({
    editor,
    shape,
    createdFile,
    nodeType,
    plugin,
    canvasFile,
  });

  showToast({
    severity: "success",
    title: "Shape Converted",
    description: `Converted text to ${nodeType.name}`,
    targetCanvasId: canvasFile.path,
  });
};

/**
 * Converts an image shape to a discourse node
 */
const convertImageShapeToNode = async ({
  editor,
  shape,
  nodeType,
  plugin,
  canvasFile,
}: ConvertToDiscourseNodeArgs): Promise<void> => {
  // Get the image file from the shape
  const imageFile = await getImageFileFromShape({ shape, editor, plugin, canvasFile });

  // Open modal for user to input the node name
  const modal = new CreateNodeModal(plugin.app, {
    nodeTypes: plugin.settings.nodeTypes,
    plugin,
    initialNodeType: nodeType,
    initialTitle: imageFile?.basename || "Image",
    onNodeCreate: async (selectedNodeType: DiscourseNode, title: string) => {
      try {
        // Create the discourse node file
        const createdFile = await createDiscourseNode({
          plugin,
          nodeType: selectedNodeType,
          text: title,
        });

        if (!createdFile) {
          throw new Error("Failed to create discourse node file");
        }

        // If we have an image file, embed it in the new node
        if (imageFile) {
          await embedImageInNode(createdFile, imageFile, plugin);
        }

        // Create the discourse node shape
        await createDiscourseNodeShape({
          editor,
          shape,
          createdFile,
          nodeType: selectedNodeType,
          plugin,
          canvasFile,
        });

        showToast({
          severity: "success",
          title: "Shape Converted",
          description: `Converted image to ${selectedNodeType.name}`,
          targetCanvasId: canvasFile.path,
        });
      } catch (error) {
        console.error("Error creating node from image:", error);
        throw error;
      }
    },
  });

  modal.open();
};

/**
 * Embeds an image in a discourse node file
 */
const embedImageInNode = async (
  nodeFile: TFile,
  imageFile: TFile,
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const imageLink = plugin.app.metadataCache.fileToLinktext(
    imageFile,
    nodeFile.path,
  );
  const imageEmbed = `![[${imageLink}]]`;

  // Add image after the frontmatter
  await plugin.app.vault.process(nodeFile, (data: string) => {
    const fileCache = plugin.app.metadataCache.getFileCache(nodeFile);
    const { start, end } = fileCache?.frontmatterPosition ?? {
      start: { offset: 0 },
      end: { offset: 0 },
    };

    const frontmatter = data.slice(start.offset, end.offset);
    const rest = data.slice(end.offset);

    return `${frontmatter}\n\n${imageEmbed}\n${rest}`;
  });
};

/**
 * Creates a discourse node shape in the canvas
 */
const createDiscourseNodeShape = async ({
  editor,
  shape,
  createdFile,
  nodeType,
  plugin,
  canvasFile,
}: {
  editor: Editor;
  shape: TLShape;
  createdFile: TFile;
  nodeType: DiscourseNode;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
}): Promise<void> => {
  // Create the blockref link
  const src = await addWikilinkBlockrefForFile({
    app: plugin.app,
    canvasFile,
    linkedFile: createdFile,
  });

  // Get the position and size of the original shape
  const { x, y } = shape;
  const width = "w" in shape.props ? Number(shape.props.w) : 200;
  const height = "h" in shape.props ? Number(shape.props.h) : 100;

  // Create the new discourse node shape
  const shapeId = createShapeId();
  editor.createShape({
    id: shapeId,
    type: "discourse-node",
    x,
    y,
    props: {
      w: Math.max(width, 200),
      h: Math.max(height, 100),
      src: src ?? "",
      title: createdFile.basename,
      nodeTypeId: nodeType.id,
    },
  });

  // Delete the original shape
  editor.deleteShape(shape.id);

  // Select the new shape
  editor.setSelectedShapes([shapeId]);

  // Mark history point
  editor.markHistoryStoppingPoint(
    `convert ${shape.type} to discourse node`,
  );
};

/**
 * Converts a text or image shape to a discourse node
 */
export const convertToDiscourseNode = async (
  args: ConvertToDiscourseNodeArgs,
): Promise<void> => {
  try {
    const { shape } = args;

    if (shape.type === "text") {
      await convertTextShapeToNode(args);
    } else if (shape.type === "image") {
      await convertImageShapeToNode(args);
    } else {
      showToast({
        severity: "warning",
        title: "Cannot Convert",
        description: "Only text and image shapes can be converted",
        targetCanvasId: args.canvasFile.path,
      });
    }
  } catch (error) {
    console.error("Error converting shape to discourse node:", error);
    showToast({
      severity: "error",
      title: "Conversion Failed",
      description: `Could not convert shape: ${error instanceof Error ? error.message : "Unknown error"}`,
      targetCanvasId: args.canvasFile.path,
    });
  }
};

