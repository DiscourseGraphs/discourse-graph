import {
  Editor,
  TLShape,
  createShapeId,
  TLAssetId,
  TLRichText,
  TLShapeId,
  renderPlaintextFromRichText,
} from "tldraw";
import type { TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import DiscourseGraphPlugin from "~/index";
import { createDiscourseNode as createDiscourseNodeFile } from "~/utils/createNode";
import {
  addWikilinkBlockrefForFile,
  extractBlockRefId,
  resolveLinkedTFileByBlockRef,
} from "~/components/canvas/stores/assetStore";
import { showToast } from "./toastUtils";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";

// Arrow is excluded on purpose: it owns the "Relation" submenu instead.
const TEXT_BEARING_SHAPE_TYPES: readonly string[] = ["text", "geo", "note"];

const getShapeText = (editor: Editor, shape: TLShape): string => {
  if (!TEXT_BEARING_SHAPE_TYPES.includes(shape.type)) return "";
  const { richText } = shape.props as { richText?: TLRichText };
  if (!richText) return "";
  return renderPlaintextFromRichText(editor, richText).trim();
};

export const canConvertShapeToNode = (
  editor: Editor,
  shape: TLShape | null,
): boolean => {
  if (!shape) return false;
  return shape.type === "image" || getShapeText(editor, shape) !== "";
};

type ConvertToDiscourseNodeArgs = {
  editor: Editor;
  shape: TLShape;
  nodeType: DiscourseNode;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

export const convertToDiscourseNode = async (
  args: ConvertToDiscourseNodeArgs,
): Promise<string | undefined> => {
  try {
    const { shape } = args;

    if (shape.type === "image") {
      return await convertImageShapeToNode(args);
    } else if (TEXT_BEARING_SHAPE_TYPES.includes(shape.type)) {
      return convertTextBearingShapeToNode(args);
    } else {
      showToast({
        severity: "warning",
        title: "Cannot Convert",
        description: "Only shapes with text and images can be converted",
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

const convertTextBearingShapeToNode = ({
  editor,
  shape,
  nodeType,
  plugin,
  canvasFile,
}: ConvertToDiscourseNodeArgs): TLShapeId | undefined => {
  const text = getShapeText(editor, shape);

  if (!text) {
    showToast({
      severity: "warning",
      title: "Cannot Convert",
      description: "Shape has no text to convert",
      targetCanvasId: canvasFile.path,
    });
    return undefined;
  }

  let shapeId: TLShapeId | undefined;

  const modal = new ModifyNodeModal(plugin.app, {
    nodeTypes: plugin.settings.nodeTypes,
    plugin,
    initialNodeType: nodeType,
    initialTitle: text,
    onSubmit: async ({
      nodeType: selectedNodeType,
      title,
      selectedExistingNode,
    }) => {
      try {
        const file =
          selectedExistingNode ??
          (await createDiscourseNodeFile({
            plugin,
            nodeType: selectedNodeType,
            text: title,
          }));

        if (!file) {
          throw new Error("Failed to create discourse node file");
        }

        shapeId = await createDiscourseNodeShape({
          editor,
          shape,
          createdFile: file,
          nodeType: selectedNodeType,
          plugin,
          canvasFile,
        });

        showToast({
          severity: "success",
          title: "Shape Converted",
          description: `Converted shape to ${selectedNodeType.name}`,
          targetCanvasId: canvasFile.path,
        });
      } catch (error) {
        console.error("Error creating node from shape text:", error);
        throw error;
      }
    },
  });

  modal.open();

  return shapeId;
};

const convertImageShapeToNode = async ({
  editor,
  shape,
  nodeType,
  plugin,
  canvasFile,
}: ConvertToDiscourseNodeArgs): Promise<TLShapeId | undefined> => {
  const imageFile = await getImageFileFromShape({
    shape,
    editor,
    plugin,
    canvasFile,
  });

  let shapeId: TLShapeId | undefined;

  const modal = new ModifyNodeModal(plugin.app, {
    nodeTypes: plugin.settings.nodeTypes,
    plugin,
    initialNodeType: nodeType,
    initialTitle: "",
    onSubmit: async ({
      nodeType: selectedNodeType,
      title,
      selectedExistingNode,
    }) => {
      try {
        const file =
          selectedExistingNode ??
          (await createDiscourseNodeFile({
            plugin,
            nodeType: selectedNodeType,
            text: title,
          }));

        if (!file) {
          throw new Error("Failed to create discourse node file");
        }

        let imageSrc: string | undefined;
        if (imageFile) {
          await embedImageInNode(file, imageFile, plugin);

          imageSrc = plugin.app.vault.getResourcePath(imageFile);
        }

        shapeId = await createDiscourseNodeShape({
          editor,
          shape,
          createdFile: file,
          nodeType: selectedNodeType,
          plugin,
          canvasFile,
          imageSrc,
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

  return shapeId;
};

const createDiscourseNodeShape = async ({
  editor,
  shape,
  createdFile,
  nodeType,
  plugin,
  canvasFile,
  imageSrc,
}: {
  editor: Editor;
  shape: TLShape;
  createdFile: TFile;
  nodeType: DiscourseNode;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  imageSrc?: string;
}): Promise<TLShapeId> => {
  const src = await addWikilinkBlockrefForFile({
    app: plugin.app,
    canvasFile,
    linkedFile: createdFile,
  });

  const { x, y } = shape;

  const { w, h } = await calcDiscourseNodeSize({
    title: createdFile.basename,
    nodeTypeId: nodeType.id,
    imageSrc,
    plugin,
  });

  const shapeId = createShapeId();
  editor.createShape({
    id: shapeId,
    type: "discourse-node",
    x,
    y,
    props: {
      w,
      h,
      src: src ?? "",
      title: createdFile.basename,
      nodeTypeId: nodeType.id,
      imageSrc,
    },
  });

  editor.deleteShape(shape.id);
  editor.setSelectedShapes([shapeId]);

  editor.markHistoryStoppingPoint(`convert ${shape.type} to discourse node`);

  return shapeId;
};

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
    const assetId =
      "assetId" in shape.props ? (shape.props.assetId as TLAssetId) : null;
    if (!assetId) return null;

    const asset = editor.getAsset(assetId);
    if (!asset) return null;

    const src = asset.props.src;
    if (!src) return null;

    const blockRefId = extractBlockRefId(src);
    if (!blockRefId) return null;

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

  await plugin.app.vault.process(nodeFile, (data: string) => {
    return `${data}\n${imageEmbed}\n`;
  });
};
