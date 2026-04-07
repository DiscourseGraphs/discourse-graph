import React, { useState, useCallback, useEffect, useMemo } from "react";
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
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { setDiscourseNodeSetting } from "~/components/settings/utils/accessors";
import DiscourseNodeSuggestiveRules from "./DiscourseNodeSuggestiveRules";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  DiscourseNodeTextPanel,
  DiscourseNodeFlagPanel,
  DiscourseNodeSelectPanel,
} from "./components/BlockPropSettingPanels";

const TEMPLATE_SETTING_KEYS = ["template"];

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
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);
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

  const canvasTree = useMemo(
    () => getBasicTreeByParentUid(canvasUid),
    [canvasUid],
  );
  const [color, setColor] = useState<string>(() => {
    const colorValue = getSettingValueFromTree({
      tree: canvasTree,
      key: "color",
    });
    return formatHexColor(colorValue);
  });

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
        isSpecificationEnabled = !!getSubTree({
          tree: getBasicTreeByParentUid(specificationUid),
          key: "enabled",
        })?.uid?.length;
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
    [specificationUid],
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
                settingKeys={["description"]}
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
                settingKeys={["shortcut"]}
                initialValue={node.shortcut}
                order={0}
                parentUid={node.type}
                uid={shortcutUid}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Tag"
                description={`Designate a hashtag for marking potential ${node.text}.`}
                settingKeys={["tag"]}
                initialValue={node.tag}
                placeholder={generateTagPlaceholder(node)}
                error={tagError}
                onChange={setTagValue}
                order={2}
                parentUid={node.type}
                uid={tagUid}
              />
              <div>
                <Label style={{ marginBottom: "4px" }}>Color</Label>
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
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Format"
                description={`DEPRECATED - Use specification instead. The format ${node.text} pages should have.`}
                settingKeys={["format"]}
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
                settingKeys={["overlay"]}
                options={attributeNode.children.map((c) => c.text)}
                initialValue={getBasicTreeByParentUid(overlayUid)[0]?.text}
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
                settingKeys={["graphOverview"]}
                initialValue={node.graphOverview}
                order={0}
                parentUid={node.type}
                uid={graphOverviewUid}
              />
            </div>
          }
        />
        {settings.suggestiveModeEnabled.value && (
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
