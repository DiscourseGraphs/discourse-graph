import { useEditor, createShapeId } from "tldraw";
import * as React from "react";
import { CreateNodeModal } from "./CreateNodeModal";
import { Notice } from "obsidian";
import { DiscourseNode } from "~/types";
import DiscourseGraphPlugin from "~/index";
import { createDiscourseNode } from "~/utils/createNode";

export function DiscourseNodePanel({
  plugin,
}: {
  plugin: DiscourseGraphPlugin;
}) {
  const editor = useEditor();

  const handleNodeTypeSelect = React.useCallback(
    async (
      selectedNodeType: DiscourseNode,
      position?: { x: number; y: number },
    ) => {
      // Use provided position or viewport center
      const finalPosition = position || editor.getViewportScreenCenter();

      const modal = new CreateNodeModal(plugin.app, {
        nodeTypes: plugin.settings.nodeTypes,
        plugin: plugin,
        initialNodeType: selectedNodeType,
        onNodeCreate: async (nodeType, title) => {
          try {
            const file = await createDiscourseNode({
              plugin,
              nodeType,
              text: title,
            });

            const shapeId = createShapeId();
            editor.createShape({
              id: shapeId,
              type: "discourse-node",
              x: finalPosition.x,
              y: finalPosition.y,
              props: {
                nodeType: nodeType.id,
                filePath: file?.path || "",
                w: 200,
                h: 100,
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
    [editor, plugin],
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
              onClick={() => handleNodeTypeSelect(nodeType)}
            >
              {nodeType.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
