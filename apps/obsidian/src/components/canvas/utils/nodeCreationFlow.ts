import { TFile } from "obsidian";
import { Editor, createShapeId } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { createDiscourseNode } from "~/utils/createNode";
import { addWikilinkBlockrefForFile } from "~/components/canvas/stores/assetStore";
import { showToast } from "./toastUtils";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";
import { getFirstImageSrcForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";

export type CreateNodeAtArgs = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  tldrawEditor: Editor;
  position: { x: number; y: number };
  initialNodeType?: DiscourseNode;
};

export const openCreateDiscourseNodeAt = (args: CreateNodeAtArgs): void => {
  const { plugin, canvasFile, tldrawEditor, position, initialNodeType } = args;

  const modal = new ModifyNodeModal(plugin.app, {
    nodeTypes: plugin.settings.nodeTypes,
    plugin,
    initialNodeType,
    onSubmit: async ({
      nodeType: selectedNodeType,
      title,
      selectedExistingNode,
    }) => {
      try {
        // If user selected an existing node, use it instead of creating a new one
        const fileToUse = selectedExistingNode
          ? selectedExistingNode
          : await createDiscourseNode({
              plugin,
              nodeType: selectedNodeType,
              text: title,
            });

        if (!fileToUse) {
          throw new Error("Failed to get discourse node file");
        }

        const src = await addWikilinkBlockrefForFile({
          app: plugin.app,
          canvasFile,
          linkedFile: fileToUse,
        });

        let preloadedImageSrc: string | undefined = undefined;
        if (selectedNodeType.keyImage) {
          try {
            const found = await getFirstImageSrcForFile(plugin.app, fileToUse);
            if (found) preloadedImageSrc = found;
          } catch (e) {
            console.warn("nodeCreationFlow: failed to preload key image", e);
          }
        }

        // Calculate optimal dimensions using dynamic measurement
        const { w, h } = await calcDiscourseNodeSize({
          title: fileToUse.basename,
          nodeTypeId: selectedNodeType.id,
          imageSrc: preloadedImageSrc,
          plugin,
        });

        const shapeId = createShapeId();
        tldrawEditor.createShape({
          id: shapeId,
          type: "discourse-node",
          x: position.x,
          y: position.y,
          props: {
            w,
            h,
            src: src ?? "",
            title: fileToUse.basename,
            nodeTypeId: selectedNodeType.id,
            imageSrc: preloadedImageSrc,
          },
        });

        tldrawEditor.markHistoryStoppingPoint(
          `create discourse node ${selectedNodeType.id}`,
        );
        tldrawEditor.setSelectedShapes([shapeId]);
        tldrawEditor.setCurrentTool("select");
      } catch (error) {
        console.error("Error creating discourse node:", error);
        showToast({
          severity: "error",
          title: "Failed to Create Node",
          description: `Could not create discourse node: ${error instanceof Error ? error.message : "Unknown error"}`,
          targetCanvasId: canvasFile.path,
        });
      }
    },
  });

  modal.open();
};
