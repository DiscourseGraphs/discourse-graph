import { useEditor, createShapeId } from "tldraw";
import * as React from "react";
import { CreateNodeModal } from "./CreateNodeModal";
import { Notice, TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import DiscourseGraphPlugin from "~/index";
import { createDiscourseNode } from "~/utils/createNode";
import { addWikilinkBlockrefForFile } from "~/utils/assetStore";

export const DiscourseNodePanel = ({
  plugin,
  canvasFile,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
}) => {
  const editor = useEditor();

  const handleNodeTypeSelect = React.useCallback(
    (selectedNodeType: DiscourseNode, position?: { x: number; y: number }) => {
      // Use provided position or viewport center
      const finalPosition = position || editor.getViewportScreenCenter();

      const modal = new CreateNodeModal(plugin.app, {
        nodeTypes: plugin.settings.nodeTypes,
        plugin: plugin,
        initialNodeType: selectedNodeType,
        onNodeCreate: async (nodeType, title) => {
          try {
            const createdFile = await createDiscourseNode({
              plugin,
              nodeType,
              text: title,
            });

            const src = createdFile
              ? await addWikilinkBlockrefForFile(
                  plugin.app,
                  canvasFile,
                  createdFile,
                )
              : null;

            const shapeId = createShapeId();
            editor.createShape({
              id: shapeId,
              type: "discourse-node",
              x: finalPosition.x,
              y: finalPosition.y,
              props: {
                w: 200,
                h: 100,
                src: src ?? "",
              },
            });

            editor.markHistoryStoppingPoint("create discourse node");
            editor.setSelectedShapes([shapeId]);
          } catch (error) {
            console.error("Error creating discourse node:", error);
            new Notice("Failed to create discourse node");
          }
        },
      });

      modal.open();
    },
    [editor, plugin, canvasFile],
  );

  const nodeTypes = plugin.settings.nodeTypes;

  return (
    <div className="tlui-style-panel__wrapper">
      <div className="tlui-style-panel__section">
        <h3 className="tlui-style-panel__header">Discourse Node Types</h3>
        <div className="tlui-style-panel__grid">
          {nodeTypes.map((nodeType) => (
            // TODO: add the ability to create node shape with drag and drop
            <button
              key={nodeType.id}
              className="tlui-button tlui-button-grid"
              onClick={() => {
                void handleNodeTypeSelect(nodeType);
              }}
            >
              {nodeType.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
