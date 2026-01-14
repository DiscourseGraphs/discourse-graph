import React, { useState, useCallback, useRef } from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import { getSubTree } from "roamjs-components/util";
import Description from "roamjs-components/components/Description";
import { Label, Tabs, Tab, TabId, InputGroup } from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import DiscourseNodeSpecification from "./DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./DiscourseNodeAttributes";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import DiscourseNodeCanvasSettings from "./DiscourseNodeCanvasSettings";
import DiscourseNodeIndex from "./DiscourseNodeIndex";
import { OnloadArgs } from "roamjs-components/types";
import DiscourseNodeSuggestiveRules from "./DiscourseNodeSuggestiveRules";
import { useFeatureFlag } from "./utils/hooks";
import {
  DiscourseNodeTextPanel,
  DiscourseNodeFlagPanel,
} from "./components/BlockPropSettingPanels";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "./utils/accessors";

export const getCleanTagText = (tag: string): string => {
  return tag.replace(/^#+/, "").trim().toUpperCase();
};

const ValidatedInputPanel = ({
  label,
  description,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  error: string;
  placeholder?: string;
}) => (
  <div className="flex flex-col">
    <Label>
      {label}
      <Description description={description} />
      <InputGroup
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
      />
    </Label>
    {error && (
      <div className="mt-1 text-sm font-medium text-red-600">{error}</div>
    )}
  </div>
);

const useDebouncedBlockPropUpdater = (
  nodeType: string,
  settingKey: string,
  initialValue: string,
  isValid: boolean,
) => {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef(0);
  const isValidRef = useRef(isValid);
  isValidRef.current = isValid;

  const saveToBlockProp = useCallback(
    (text: string, timeout: boolean) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(
        () => {
          if (!isValidRef.current) {
            return;
          }
          setDiscourseNodeSetting(nodeType, [settingKey], text);
        },
        timeout ? 500 : 0,
      );
    },
    [nodeType, settingKey],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      saveToBlockProp(newValue, true);
    },
    [saveToBlockProp],
  );

  const handleBlur = useCallback(() => {
    saveToBlockProp(value, false);
  }, [value, saveToBlockProp]);

  return { value, handleChange, handleBlur };
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
  const suggestiveModeEnabled = useFeatureFlag("Suggestive Mode Enabled");
  // UIDs still needed for deferred complex settings (template, specification, etc.)
  const getUid = (key: string) =>
    getSubTree({
      parentUid: node.type,
      key: key,
    }).uid;
  const templateUid = getUid("Template");
  const specificationUid = getUid("Specification");
  const indexUid = getUid("Index");
  const overlayUid = getUid("Overlay");
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [formatError, setFormatError] = useState("");

  const {
    value: formatValue,
    handleChange: handleFormatChange,
    handleBlur: handleFormatBlurFromHook,
  } = useDebouncedBlockPropUpdater(
    node.type,
    "format",
    node.format,
    !formatError,
  );

  const validateTag = (tag: string): string | undefined => {
    const cleanTag = getCleanTagText(tag);
    if (!cleanTag) return undefined;
    const format = getDiscourseNodeSetting<string>(node.type, ["format"])!;
    const roamTagRegex = /#?\[\[(.*?)\]\]|#(\S+)/g;
    const formatTags: string[] = [];
    for (const match of format.matchAll(roamTagRegex)) {
      const tagName = match[1] || match[2];
      if (tagName) formatTags.push(tagName.toUpperCase());
    }
    if (formatTags.includes(cleanTag)) {
      return `The tag "${tag}" is referenced in the format. Please use a different tag or format.`;
    }
    return undefined;
  };

  const validateFormat = useCallback(
    ({
      format,
      isSpecificationEnabled,
    }: {
      format: string;
      isSpecificationEnabled?: boolean;
    }) => {
      if (isSpecificationEnabled === undefined)
        isSpecificationEnabled = !!getSubTree({
          tree: getBasicTreeByParentUid(specificationUid),
          key: "enabled",
        })?.uid?.length;
      if (format.trim().length === 0 && !isSpecificationEnabled) {
        setFormatError("Error: you must set either a format or specification");
        return;
      }
      const tag = getDiscourseNodeSetting<string>(node.type, ["tag"])!;
      const cleanTag = getCleanTagText(tag);

      if (!cleanTag) {
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
      } else {
        setFormatError("");
      }
    },
    [specificationUid, node.type],
  );

  const handleFormatBlur = useCallback(() => {
    handleFormatBlurFromHook();
    validateFormat({ format: formatValue });
  }, [handleFormatBlurFromHook, formatValue, validateFormat]);

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
                defaultValue={node.description}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Shortcut"
                description={`The trigger to quickly create a ${node.text} page from the node menu.`}
                settingKeys={["shortcut"]}
                defaultValue={node.shortcut}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Tag"
                description={`Designate a hashtag for marking potential ${node.text}.`}
                settingKeys={["tag"]}
                defaultValue={node.tag}
                placeholder={generateTagPlaceholder(node)}
                validate={validateTag}
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
              <ValidatedInputPanel
                label="Format"
                description={`DEPRECATED - Use specification instead. The format ${node.text} pages should have.`}
                value={formatValue}
                onChange={handleFormatChange}
                onBlur={handleFormatBlur}
                error={formatError}
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
                    validateFormat({
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
              <DiscourseNodeCanvasSettings nodeType={node.type} />
              <DiscourseNodeFlagPanel
                nodeType={node.type}
                title="Graph Overview"
                description="Whether to color the node in the graph overview based on canvas color. This is based on the node's plain title as described by a `has title` condition in its specification."
                settingKeys={["graphOverview"]}
                defaultValue={node.graphOverview}
              />
            </div>
          }
        />
        {suggestiveModeEnabled && (
          <Tab
            id="suggestive-mode"
            title="Suggestive Mode"
            panel={
              <div className="flex flex-col gap-4 p-1">
                <DiscourseNodeSuggestiveRules node={node} />
              </div>
            }
          />
        )}
      </Tabs>
    </>
  );
};

export default NodeConfig;
