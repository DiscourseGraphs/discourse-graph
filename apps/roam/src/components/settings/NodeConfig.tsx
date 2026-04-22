import React, { useState, useCallback, useEffect } from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import DualWriteBlocksPanel from "./components/EphemeralBlocksPanel";
import { getSubTree } from "roamjs-components/util";
import Description from "roamjs-components/components/Description";
import {
  Label,
  Tabs,
  Tab,
  TabId,
  InputGroup,
  ControlGroup,
  Tooltip,
  Icon,
} from "@blueprintjs/core";
import DiscourseNodeSpecification from "./DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./DiscourseNodeAttributes";
import DiscourseNodeCanvasSettings, {
  formatHexColor,
} from "./DiscourseNodeCanvasSettings";
import DiscourseNodeIndex from "./DiscourseNodeIndex";
import { OnloadArgs } from "roamjs-components/types";
import setInputSetting from "roamjs-components/util/setInputSetting";
import {
  getDiscourseNodeSetting,
  isSyncEnabled,
  setDiscourseNodeSetting,
} from "~/components/settings/utils/accessors";
import {
  DISCOURSE_NODE_KEYS,
  SPECIFICATION_KEYS,
  TEMPLATE_SETTING_KEYS,
} from "~/components/settings/utils/settingKeys";
import DiscourseNodeSuggestiveRules from "./DiscourseNodeSuggestiveRules";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import {
  DiscourseNodeTextPanel,
  DiscourseNodeFlagPanel,
  DiscourseNodeSelectPanel,
} from "./components/BlockPropSettingPanels";

export const getCleanTagText = (tag: string): string => {
  return tag.replace(/^#+/, "").trim().toUpperCase();
};

const generateTagPlaceholder = (node: DiscourseNode): string => {
  // Extract first reference from format like [[CLM]], [[QUE]], [[EVD]]
  const referenceMatch = node.format.match(/\[\[([A-Z]+)\]\]/);

  if (referenceMatch) {
    const reference = referenceMatch[1].toLowerCase();
    return `#${reference.slice(0, 3)}-candidate`; // [[EVD]] - {content} = #evd-candidate
  }

  const nodeTextPrefix = node.text.toLowerCase().slice(0, 3);
  return `#${nodeTextPrefix}-candidate`; // Evidence = #evi-candidate
};

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
  const suggestiveRulesUid = getUid("Suggestive Rules");
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [color, setColor] = useState<string>(() =>
    formatHexColor(node.canvasSettings?.color ?? ""),
  );

  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [tagError, setTagError] = useState("");
  const [formatError, setFormatError] = useState("");

  const [tagValue, setTagValue] = useState(node.tag || "");
  const [formatValue, setFormatValue] = useState(node.format || "");
  const validate = useCallback(
    ({
      tag,
      format,
      isSpecificationEnabled,
    }: {
      tag: string;
      format: string;
      isSpecificationEnabled?: boolean;
    }) => {
      if (isSpecificationEnabled === undefined)
        isSpecificationEnabled =
          getDiscourseNodeSetting<boolean>(node.type, [
            DISCOURSE_NODE_KEYS.specification,
            SPECIFICATION_KEYS.enabled,
          ]) ?? false;
      if (format.trim().length === 0 && !isSpecificationEnabled) {
        setTagError("");
        setFormatError("Error: you must set either a format or specification");
        return;
      }
      const cleanTag = getCleanTagText(tag);

      if (!cleanTag) {
        setTagError("");
        setFormatError("");
        return;
      }

      const roamTagRegex = /#?\[\[(.*?)\]\]|#(\S+)/g;
      const matches = format.matchAll(roamTagRegex);
      const formatTags: string[] = [];
      for (const match of matches) {
        const tagName = match[1] || match[2];
        if (tagName) {
          formatTags.push(tagName.toUpperCase());
        }
      }

      const hasConflict = formatTags.includes(cleanTag);

      if (hasConflict) {
        setFormatError(
          `The format references the node's tag "${tag}". Please use a different format or tag.`,
        );
        setTagError(
          `The tag "${tag}" is referenced in the format. Please use a different tag or format.`,
        );
      } else {
        setTagError("");
        setFormatError("");
      }
    },
    [node.type],
  );

  useEffect(() => {
    validate({ tag: tagValue, format: formatValue });
  }, [tagValue, formatValue, validate]);

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
            <div className="flex flex-col gap-4 p-1">
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Description"
                description={`Describing what the ${node.text} node represents in your graph.`}
                settingKeys={[DISCOURSE_NODE_KEYS.description]}
                initialValue={node.description}
                multiline
                order={1}
                parentUid={node.type}
                uid={descriptionUid}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Shortcut"
                description={`The trigger to quickly create a ${node.text} page from the node menu.`}
                settingKeys={[DISCOURSE_NODE_KEYS.shortcut]}
                initialValue={node.shortcut}
                order={0}
                parentUid={node.type}
                uid={shortcutUid}
              />
              <div>
                <DiscourseNodeTextPanel
                  nodeType={node.type}
                  title="Tag"
                  description={`Designate a hashtag for marking potential ${node.text}.`}
                  settingKeys={[DISCOURSE_NODE_KEYS.tag]}
                  initialValue={node.tag}
                  placeholder={generateTagPlaceholder(node)}
                  error={tagError}
                  onChange={setTagValue}
                  order={2}
                  parentUid={node.type}
                  uid={tagUid}
                />
                {tagValue && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <span className="text-xs italic text-gray-400">
                      Preview:
                    </span>
                    <span style={color ? getNodeTagStyles(color) : undefined}>
                      #{tagValue.replace(/^#/, "")}
                    </span>
                  </div>
                )}
              </div>
              <>
                <Label>
                  Color
                  <Description description="Changes the color of tags and canvas nodes" />
                  <ControlGroup>
                    <InputGroup
                      style={{ width: 120 }}
                      type={"color"}
                      value={color}
                      onChange={(e) => {
                        const colorValue = e.target.value.replace("#", ""); // remove hash to not create roam link
                        setColor(e.target.value);
                        void setInputSetting({
                          blockUid: canvasUid,
                          key: "color",
                          value: colorValue,
                        });
                        setDiscourseNodeSetting(
                          node.type,
                          ["canvasSettings", "color"],
                          colorValue,
                        );
                      }}
                    />
                    <Tooltip content={color ? "Unset" : "Color not set"}>
                      <Icon
                        className={"ml-2 align-middle opacity-80"}
                        icon={color ? "delete" : "info-sign"}
                        onClick={() => {
                          setColor("");
                          void setInputSetting({
                            blockUid: canvasUid,
                            key: "color",
                            value: "",
                          });
                          setDiscourseNodeSetting(
                            node.type,
                            ["canvasSettings", "color"],
                            "",
                          );
                        }}
                      />
                    </Tooltip>
                  </ControlGroup>
                </Label>
              </>
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
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Format"
                description={`DEPRECATED - Use specification instead. The format ${node.text} pages should have.`}
                settingKeys={[DISCOURSE_NODE_KEYS.format]}
                initialValue={node.format}
                error={formatError}
                onChange={setFormatValue}
                order={3}
                parentUid={node.type}
                uid={formatUid}
              />
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
                  parentSetEnabled={(isSpecificationEnabled) => {
                    validate({
                      tag: tagValue,
                      format: formatValue,
                      isSpecificationEnabled,
                    });
                  }}
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
              <DualWriteBlocksPanel
                nodeType={node.type}
                title="Template"
                description={`The template that auto fills ${node.text} page when generated.`}
                settingKeys={TEMPLATE_SETTING_KEYS}
                uid={templateUid}
              />
            </div>
          }
        />
        <Tab
          id="attributes"
          title="Attributes"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <DiscourseNodeAttributes
                uid={attributeNode.uid}
                nodeType={node.type}
              />
              <DiscourseNodeSelectPanel
                nodeType={node.type}
                title="Overlay"
                description="Select which attribute is used for the discourse overlay"
                settingKeys={[DISCOURSE_NODE_KEYS.overlay]}
                options={attributeNode.children.map((c) => c.text)}
                initialValue={
                  getDiscourseNodeSetting<string>(node.type, [
                    DISCOURSE_NODE_KEYS.overlay,
                  ]) ?? ""
                }
                order={0}
                parentUid={node.type}
                uid={overlayUid}
              />
            </div>
          }
        />
        <Tab
          id="canvas"
          title="Canvas"
          panel={
            <div className="flex flex-col gap-4 p-1">
              <DiscourseNodeCanvasSettings
                nodeType={node.type}
                uid={canvasUid}
              />
              <DiscourseNodeFlagPanel
                nodeType={node.type}
                title="Graph Overview"
                description="Whether to color the node in the graph overview based on canvas color.  This is based on the node's plain title as described by a \`has title\` condition in its specification."
                settingKeys={[DISCOURSE_NODE_KEYS.graphOverview]}
                initialValue={node.graphOverview}
                order={0}
                parentUid={node.type}
                uid={graphOverviewUid}
              />
            </div>
          }
        />
        {isSyncEnabled() && (
          <Tab
            id="suggestive-mode"
            title="Suggestive mode"
            panel={
              <div className="flex flex-col gap-4 p-1">
                <DiscourseNodeSuggestiveRules
                  node={node}
                  parentUid={suggestiveRulesUid}
                />
              </div>
            }
          />
        )}
      </Tabs>
    </>
  );
};

export default NodeConfig;
