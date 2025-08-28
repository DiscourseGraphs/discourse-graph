import { useEditor } from "tldraw";
import * as React from "react";
import { TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import DiscourseGraphPlugin from "~/index";
import { openCreateDiscourseNodeAt } from "./utils/nodeCreationFlow";

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
      const finalPosition = position || editor.getViewportScreenCenter();
      openCreateDiscourseNodeAt({
        plugin,
        canvasFile,
        tldrawEditor: editor,
        position: finalPosition,
        initialNodeType: selectedNodeType,
      });
    },
    [editor, plugin, canvasFile],
  );

  const nodeTypes = plugin.settings.nodeTypes;

  return (
    <div className="tlui-style-panel__wrapper p-2">
      <h3 className="tlui-style-panel__header">Discourse Node Types</h3>
      <div className="flex flex-col">
        {nodeTypes.map((nodeType) => (
          <button
            key={nodeType.id}
            className="tlui-button tlui-button__menu flex w-full flex-row !justify-start gap-2"
            draggable
            onDragStart={(e) => {
              e.dataTransfer?.setData(
                "application/x-dg-node-type",
                nodeType.id,
              );
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "copyMove";
              }
            }}
            onClick={() => {
              void handleNodeTypeSelect(nodeType);
            }}
          >
            <span className="text-sm">{nodeType.name}</span>
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: nodeType.color }}
            ></div>
          </button>
        ))}
      </div>
    </div>
  );
};
