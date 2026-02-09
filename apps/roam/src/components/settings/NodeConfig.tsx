import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
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
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  DiscourseNodeTextPanel,
  DiscourseNodeFlagPanel,
} from "./components/BlockPropSettingPanels";
import createBlock from "roamjs-components/writes/createBlock";
import updateBlock from "roamjs-components/writes/updateBlock";

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
              void updateBlock({ uid: existingBlock.uid, text });
            }
          } else if (text) {
            void createBlock({ parentUid: uid, node: { text } });
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
  const specificationUid = getUid("Specification");
  const indexUid = getUid("Index");
  const overlayUid = getUid("Overlay");
  const graphOverviewUid = getUid("Graph Overview");
  const canvasUid = getUid("Canvas");
  const suggestiveRulesUid = getUid("Suggestive Rules");
  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [formatError, setFormatError] = useState("");
  const [tagValue, setTagValue] = useState(node.tag || "");

  const {
    value: formatValue,
    handleChange: handleFormatChange,
    handleBlur: handleFormatBlurFromHook,
  } = useDebouncedRoamUpdater(
    formatUid,
    node.format,
    !formatError,
  );

  const validateTag = useCallback(
    (tag: string): string | undefined => {
      const cleanTag = getCleanTagText(tag);
      if (!cleanTag) return undefined;
      const roamTagRegex = /#?\[\[(.*?)\]\]|#(\S+)/g;
      const formatTags: string[] = [];
      for (const match of formatValue.matchAll(roamTagRegex)) {
        const tagName = match[1] || match[2];
        if (tagName) formatTags.push(tagName.toUpperCase());
      }
      if (formatTags.includes(cleanTag)) {
        return `The tag "${tag}" is referenced in the format. Please use a different tag or format.`;
      }
      return undefined;
    },
    [formatValue],
  );

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
      const cleanTag = getCleanTagText(tagValue);

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
          `The format references the node's tag "${tagValue}". Please use a different format or tag.`,
        );
      } else {
        setFormatError("");
      }
    },
    [specificationUid, tagValue],
  );

  useEffect(() => {
    validateFormat({ format: formatValue });
  }, [tagValue, formatValue, validateFormat]);

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
                order={1}
                parentUid={node.type}
                uid={descriptionUid}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Shortcut"
                description={`The trigger to quickly create a ${node.text} page from the node menu.`}
                settingKeys={["shortcut"]}
                defaultValue={node.shortcut}
                order={0}
                parentUid={node.type}
                uid={shortcutUid}
              />
              <DiscourseNodeTextPanel
                nodeType={node.type}
                title="Tag"
                description={`Designate a hashtag for marking potential ${node.text}.`}
                settingKeys={["tag"]}
                defaultValue={node.tag}
                placeholder={generateTagPlaceholder(node)}
                validate={validateTag}
                onChange={setTagValue}
                order={2}
                parentUid={node.type}
                uid={tagUid}
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
                description="Select which attribute is used for the discourse overlay"
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
              <DiscourseNodeCanvasSettings nodeType={node.type} uid={canvasUid} />
              <DiscourseNodeFlagPanel
                nodeType={node.type}
                title="Graph Overview"
                description="Whether to color the node in the graph overview based on canvas color. This is based on the node's plain title as described by a `has title` condition in its specification."
                settingKeys={["graphOverview"]}
                defaultValue={node.graphOverview}
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
                <DiscourseNodeSuggestiveRules node={node} parentUid={suggestiveRulesUid} />
              </div>
            }
          />
        )}
      </Tabs>
    </>
  );
};

export default NodeConfig;
