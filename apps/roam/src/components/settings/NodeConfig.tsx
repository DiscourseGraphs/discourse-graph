import React, { useState } from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getSubTree } from "roamjs-components/util";
import Description from "roamjs-components/components/Description";
import { Label, Tabs, Tab, TabId } from "@blueprintjs/core";
import DiscourseNodeSpecification from "./DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./DiscourseNodeAttributes";
import DiscourseNodeCanvasSettings from "./DiscourseNodeCanvasSettings";
import DiscourseNodeIndex from "./DiscourseNodeIndex";
import { OnloadArgs } from "roamjs-components/types";

const NodeConfig = ({
  node,
  onloadArgs,
}: {
  node: DiscourseNode;
  onloadArgs: OnloadArgs;
}) => {
  const getUid = (key: string) =>
    getSubTree({
      parentUid: node.type,
      key: key,
    }).uid;
  const formatUid = getUid("Format");
  const descriptionUid = getUid("Description");
  const shortcutUid = getUid("Shortcut");
  const templateUid = getUid("Template");
  const overlayUid = getUid("Overlay");
  const canvasUid = getUid("Canvas");
  const graphOverviewUid = getUid("Graph Overview");
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("main");

  return (
    <>
      <Tabs
        onChange={(id) => setSelectedTabId(id)}
        selectedTabId={selectedTabId}
        renderActiveTabPanelOnly={true}
      >
        <Tab
          id="main"
          title="Main"
          panel={
            <div className="flex flex-col gap-4">
              <TextPanel
                title="Description"
                description={`Describing what the ${node.text} node represents in your graph.`}
                order={0}
                parentUid={node.type}
                uid={descriptionUid}
                defaultValue={node.description}
              />
              <TextPanel
                title="Shortcut"
                description={`The trigger to quickly create a ${node.text} page from the node menu.`}
                order={0}
                parentUid={node.type}
                uid={shortcutUid}
                defaultValue={node.shortcut}
              />
            </div>
          }
        />
        <Tab
          id="index"
          title="Index"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <DiscourseNodeIndex
                node={node}
                parentUid={node.type}
                onloadArgs={onloadArgs}
              />
            </div>
          }
        />
        <Tab
          id="format"
          title="Format"
          panel={
            <div className="flex flex-col gap-4">
              <TextPanel
                title="Format"
                description={`DEPRACATED - Use specification instead. The format ${node.text} pages should have.`}
                order={0}
                parentUid={node.type}
                uid={formatUid}
                defaultValue={node.format}
              />
              <Label>
                Specification
                <Description
                  description={
                    "The conditions specified to identify a ${nodeText} node."
                  }
                />
                <DiscourseNodeSpecification node={node} parentUid={node.type} />
              </Label>
            </div>
          }
        />
        <Tab
          id="template"
          title="Template"
          panel={
            <div className="flex flex-col gap-4">
              <BlocksPanel
                title="Template"
                description={`The template that auto fills ${node.text} page when generated.`}
                order={0}
                parentUid={node.type}
                uid={templateUid}
                defaultValue={node.template}
              />
            </div>
          }
        />
        <Tab
          id="attributes"
          title="Attributes"
          panel={
            <div className="flex flex-col gap-4">
              <DiscourseNodeAttributes uid={attributeNode.uid} />
              <SelectPanel
                title="Overlay"
                description="Select which attribute is used for the Discourse Overlay"
                order={0}
                parentUid={node.type}
                uid={overlayUid}
                options={{
                  items: () => attributeNode.children.map((c) => c.text),
                }}
              />
            </div>
          }
        />
        <Tab
          id="canvas"
          title="Canvas"
          panel={
            <div className="flex flex-col gap-4">
              {" "}
              <DiscourseNodeCanvasSettings uid={canvasUid} />
              <FlagPanel
                title="Graph Overview"
                description="Whether to color the node in the graph overview based on canvas color.  This is based on the node's plain title as described by a \`has title\` condition in its specification."
                order={0}
                parentUid={node.type}
                uid={graphOverviewUid}
                value={node.graphOverview}
              />
            </div>
          }
        />
      </Tabs>
    </>
  );
};

export default NodeConfig;
