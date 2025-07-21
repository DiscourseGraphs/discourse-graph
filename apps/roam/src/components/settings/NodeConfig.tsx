import React, { useState, useCallback } from "react";
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
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

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
  const tagUid = getUid("Tag");
  const templateUid = getUid("Template");
  const overlayUid = getUid("Overlay");
  const canvasUid = getUid("Canvas");
  const graphOverviewUid = getUid("Graph Overview");
  const specificationUid = getUid("Specification");
  const indexUid = getUid("Index");
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [tagError, setTagError] = useState("");
  const [formatError, setFormatError] = useState("");

  const getCleanTagText = (tag: string): string => {
    return tag.replace(/^#+/, "").trim().toUpperCase();
  };

  const validateOnBlur = useCallback(() => {
    const tagValue = getBasicTreeByParentUid(tagUid)[0]?.text || "";
    const formatValue = getBasicTreeByParentUid(formatUid)[0]?.text || "";

    const cleanTag = getCleanTagText(tagValue);

    if (!cleanTag) {
      setTagError("");
      setFormatError("");
      return;
    }

    const formatWithoutPlaceholders = formatValue.replace(/{[^}]+}/g, "");
    const formatUpper = formatWithoutPlaceholders.toUpperCase();
    const formatParts = formatUpper.split(/[^A-Z0-9]/);
    const hasConflict = formatParts.includes(cleanTag);

    if (hasConflict) {
      const formatForMessage = formatWithoutPlaceholders
        .trim()
        .replace(/(\s*-)*$/, "");
      setFormatError(
        `Format "${formatForMessage}" conflicts with tag: "${tagValue}". Please use some other format.`,
      );
      setTagError(
        `Tag "${tagValue}" conflicts with format "${formatForMessage}". Please use some other tag.`,
      );
    } else {
      setTagError("");
      setFormatError("");
    }
  }, [tagUid, formatUid]);

  return (
    <>
      <Tabs
        onChange={(id) => setSelectedTabId(id)}
        selectedTabId={selectedTabId}
        renderActiveTabPanelOnly={true}
      >
        <Tab
          id="general"
          title="General"
          panel={
            <div className="flex flex-row gap-4 p-1">
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
              <div onBlur={validateOnBlur}>
                <TextPanel
                  title="Tag"
                  description={`Designate a hashtag for marking potential ${node.text}.`}
                  order={0}
                  parentUid={node.type}
                  uid={tagUid}
                  defaultValue={node.tag}
                />
                {tagError && (
                  <div className="mt-1 text-sm font-medium text-red-600">
                    {tagError}
                  </div>
                )}
              </div>
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
                parentUid={indexUid}
                onloadArgs={onloadArgs}
              />
            </div>
          }
        />
        <Tab
          id="format"
          title="Format"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <div onBlur={validateOnBlur}>
                <TextPanel
                  title="Format"
                  description={`DEPRECATED - Use specification instead. The format ${node.text} pages should have.`}
                  order={0}
                  parentUid={node.type}
                  uid={formatUid}
                  defaultValue={node.format}
                />
                {formatError && (
                  <div className="mt-1 text-sm font-medium text-red-600">
                    {formatError}
                  </div>
                )}
              </div>
              <Label>
                Specification
                <Description
                  description={
                    "The conditions specified to identify a ${nodeText} node."
                  }
                />
                <DiscourseNodeSpecification
                  node={node}
                  parentUid={specificationUid}
                />
              </Label>
            </div>
          }
        />
        <Tab
          id="template"
          title="Template"
          panel={
            <div className="flex flex-col gap-4 p-1">
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
            <div className="flex flex-col gap-4 p-1">
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
            <div className="flex flex-col gap-4 p-1">
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
