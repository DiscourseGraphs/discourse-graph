import { DefaultQuickActions, TLUiQuickActionsProps, useEditor, TLShapeId, createShapeId } from "tldraw";
import * as React from "react";
import { useApp } from "./AppContext";
import { DiscourseNodeShape } from "~/utils/shapes/DiscourseNodeShape";
import DiscourseGraphPlugin from "~/index";

export function DiscourseNodePanel({ plugin }: { plugin: DiscourseGraphPlugin }) {
  const editor = useEditor();
  const app = useApp();

  const handleNodeTypeSelect = React.useCallback(async (nodeType: string) => {
    // Create a new discourse node at the center of the viewport
    const { x, y } = editor.getViewportScreenCenter();
    
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: "discourse-node",
      x,
      y,
      props: {
        text: "New Discourse Node",
        nodeType: nodeType,
        filePath: "",
        w: 200,
        h: 100,
      },
    });
    
    // Select the new node
    editor.markHistoryStoppingPoint("select shape");
    editor.setSelectedShapes([shapeId]);

  }, [editor]);

  // TODO: Get node types from app context
  const nodeTypes = plugin.settings.nodeTypes;

  return (
    <div className="tlui-style-panel__wrapper">
      <div className="tlui-style-panel__section">
        <h3 className="tlui-style-panel__header">Discourse Node Types</h3>
        <div className="tlui-style-panel__grid">
          {nodeTypes.map((nodeType) => (
            <button
              key={nodeType.id}
              className="tlui-button tlui-button-grid"
              onClick={() => handleNodeTypeSelect(nodeType.id)}
            >
              {nodeType.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}