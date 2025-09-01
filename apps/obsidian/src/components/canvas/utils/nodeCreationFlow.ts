import { Notice, TFile } from "obsidian";
import { Editor, createShapeId } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { createDiscourseNode } from "~/utils/createNode";
import { addWikilinkBlockrefForFile } from "~/components/canvas/stores/assetStore";

export type CreateNodeAtArgs = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  tldrawEditor: Editor;
  position: { x: number; y: number };
  initialNodeType?: DiscourseNode;
};

export const openCreateDiscourseNodeAt = (args: CreateNodeAtArgs): void => {
  const { plugin, canvasFile, tldrawEditor, position, initialNodeType } = args;

  const modal = new CreateNodeModal(plugin.app, {
    nodeTypes: plugin.settings.nodeTypes,
    plugin,
    initialNodeType,
    onNodeCreate: async (selectedNodeType: DiscourseNode, title: string) => {
      try {
        const createdFile = await createDiscourseNode({
          plugin,
          nodeType: selectedNodeType,
          text: title,
        });

        if (!createdFile) {
          throw new Error("Failed to create discourse node file");
        }

        const src = await addWikilinkBlockrefForFile({
          app: plugin.app,
          canvasFile,
          linkedFile: createdFile,
        });

        const shapeId = createShapeId();
        tldrawEditor.createShape({
          id: shapeId,
          type: "discourse-node",
          x: position.x,
          y: position.y,
          props: {
            w: 200,
            h: 100,
            src: src ?? "",
            title: createdFile.basename,
            nodeTypeId: selectedNodeType.id,
          },
        });

        tldrawEditor.markHistoryStoppingPoint(
          `create discourse node ${selectedNodeType.id}`,
        );
        tldrawEditor.setSelectedShapes([shapeId]);
      } catch (error) {
        console.error("Error creating discourse node:", error);
        new Notice(`Failed to create discourse node: ${JSON.stringify(error)}`);
      }
    },
  });

  modal.open();
};
