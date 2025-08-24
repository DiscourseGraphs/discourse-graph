import React from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { DiscourseRelation } from "~/utils/getDiscourseRelations";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { useEditor, useValue } from "tldraw";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";

export type DiscourseGraphPanelProps = {
  nodes: DiscourseNode[];
  relations: string[];
};

const DiscourseGraphPanel = ({
  nodes,
  relations,
}: DiscourseGraphPanelProps) => {
  const editor = useEditor();

  const currentToolId = useValue(
    "currentToolId",
    () => {
      return editor.getCurrentToolId();
    },
    [editor],
  );

  const uniqueRelations = [...new Set(relations)];

  const currentNodeTool = nodes.find((node) => node.type === currentToolId);
  const currentRelationTool = uniqueRelations.find(
    (relation) => relation === currentToolId,
  );

  // If it's a node tool, show only that node
  if (currentNodeTool) {
    return (
      <div className="tlui-layout__top__right">
        <div className="tlui-style-panel tlui-style-panel__wrapper">
          <div
            className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
            style={{
              justifyContent: "flex-start",
            }}
            onClick={() => editor.setCurrentTool("discourse-tool")}
          >
            <span
              className="tlui-icon tlui-button__icon mr-2"
              style={{
                mask: `url("https://cdn.tldraw.com/2.3.0/icons/icon/color.svg") center 100% / 100% no-repeat`,
                backgroundColor:
                  formatHexColor(currentNodeTool.canvasSettings.color) ||
                  "black",
              }}
            />
            <span>{currentNodeTool.text}</span>
          </div>
        </div>
      </div>
    );
  }

  // If it's a relation tool, show only that relation
  if (currentRelationTool) {
    const color = getRelationColor(
      currentRelationTool,
      uniqueRelations.indexOf(currentRelationTool),
    );
    return (
      <div className="tlui-layout__top__right">
        <div className="tlui-style-panel tlui-style-panel__wrapper">
          <div
            className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
            style={{
              justifyContent: "flex-start",
            }}
            onClick={() => editor.setCurrentTool("discourse-tool")}
          >
            <div
              className="tlui-icon tlui-button__icon mr-2"
              style={{
                color,
                mask: `url("https://cdn.tldraw.com/2.3.0/icons/icon/tool-arrow.svg") center 100% / 100% no-repeat`,
              }}
            ></div>
            <span>{currentRelationTool}</span>
          </div>
        </div>
      </div>
    );
  }

  return currentToolId === "discourse-tool" ? (
    <div className="tlui-layout__top__right">
      <div className="tlui-style-panel tlui-style-panel__wrapper">
        {/* Nodes Section */}
        <>
          {nodes.map((n) => (
            <div
              key={n.type}
              className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
              style={{
                justifyContent: "flex-start",
              }}
              onClick={() => editor.setCurrentTool(n.type)}
            >
              <span
                className="tlui-icon tlui-button__icon mr-2"
                style={{
                  mask: `url("https://cdn.tldraw.com/2.3.0/icons/icon/color.svg") center 100% / 100% no-repeat`,
                  backgroundColor:
                    formatHexColor(n.canvasSettings.color) || "black",
                }}
              />
              <span>{n.text}</span>
            </div>
          ))}
        </>

        {/* Relations Section */}
        {uniqueRelations.length > 0 && (
          <>
            {uniqueRelations.map((relation, index) => {
              const color = getRelationColor(relation, index);
              return (
                <div
                  key={relation}
                  className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
                  style={{
                    justifyContent: "flex-start",
                  }}
                  onClick={() => editor.setCurrentTool(relation)}
                >
                  <div
                    className="tlui-icon tlui-button__icon mr-2"
                    style={{
                      color,
                      mask: `url("https://cdn.tldraw.com/2.3.0/icons/icon/tool-arrow.svg") center 100% / 100% no-repeat`,
                    }}
                  ></div>
                  <span>{relation}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  ) : null;
};

export default DiscourseGraphPanel;
