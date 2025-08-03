import React, { useState, useCallback, useRef, useEffect } from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getSubTree } from "roamjs-components/util";
import Description from "roamjs-components/components/Description";
import { Label, Tabs, Tab, TabId, InputGroup } from "@blueprintjs/core";
import DiscourseNodeSpecification from "./DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./DiscourseNodeAttributes";
import DiscourseNodeCanvasSettings from "./DiscourseNodeCanvasSettings";
import DiscourseNodeIndex from "./DiscourseNodeIndex";
import { OnloadArgs } from "roamjs-components/types";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import updateBlock from "roamjs-components/writes/updateBlock";

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
  <>
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
  </>
);

const useDebouncedRoamUpdater = (
  uid: string,
  initialValue: string,
  isValid: boolean,
) => {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef(0);
  const isValidRef = useRef(isValid);
  isValidRef.current = isValid;

  const saveToRoam = useCallback(
    (text: string, timeout: boolean) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(
        () => {
          if (!isValidRef.current) {
            return;
          }
          const existingBlock = getBasicTreeByParentUid(uid)[0];
          if (existingBlock) {
            if (existingBlock.text !== text) {
              updateBlock({ uid: existingBlock.uid, text });
            }
          } else if (text) {
            createBlock({ parentUid: uid, node: { text } });
          }
        },
        timeout ? 500 : 0,
      );
    },
    [uid],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      saveToRoam(newValue, true);
    },
    [saveToRoam],
  );

  const handleBlur = useCallback(() => {
    saveToRoam(value, false);
  }, [value, saveToRoam]);

  return { value, handleChange, handleBlur };
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
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [tagError, setTagError] = useState("");
  const [formatError, setFormatError] = useState("");
  const isConfigurationValid = !tagError && !formatError;

  const {
    value: tagValue,
    handleChange: handleTagChange,
    handleBlur: handleTagBlurFromHook,
  } = useDebouncedRoamUpdater(tagUid, node.tag || "", isConfigurationValid);
  const {
    value: formatValue,
    handleChange: handleFormatChange,
    handleBlur: handleFormatBlurFromHook,
  } = useDebouncedRoamUpdater(formatUid, node.format, isConfigurationValid);

  const getCleanTagText = (tag: string): string => {
    return tag.replace(/^#+/, "").trim().toUpperCase();
  };

  const validate = useCallback((tag: string, format: string) => {
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
  }, []);

  useEffect(() => {
    validate(tagValue, formatValue);
  }, [tagValue, formatValue, validate]);

  const handleTagBlur = useCallback(() => {
    handleTagBlurFromHook();
    validate(tagValue, formatValue);
  }, [handleTagBlurFromHook, tagValue, formatValue, validate]);

  const handleFormatBlur = useCallback(() => {
    handleFormatBlurFromHook();
    validate(tagValue, formatValue);
  }, [handleFormatBlurFromHook, tagValue, formatValue, validate]);

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
              <ValidatedInputPanel
                label="Tag"
                description={`Designate a hashtag for marking potential ${node.text}.`}
                value={tagValue}
                onChange={handleTagChange}
                onBlur={handleTagBlur}
                error={tagError}
                placeholder={`#${node.text}`}
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
