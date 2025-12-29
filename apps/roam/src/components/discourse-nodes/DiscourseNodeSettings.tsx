import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Label,
  Tabs,
  Tab,
  TabId,
  InputGroup,
  TextArea,
} from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import type { DiscourseNodeSettings as DiscourseNodeSettingsType } from "~/components/settings/block-prop/utils/zodSchema";
import {
  getDiscourseNodeSettings,
  setDiscourseNodeSetting,
} from "~/components/settings/block-prop/utils/accessors";
import { validateTagFormat, generateTagPlaceholder } from "./utils";
import CanvasSettings from "./CanvasSettings";
import Attributes from "./Attributes";
import { BlocksPanel } from "~/components/settings/block-prop/components/BlocksPanel";

type Props = {
  nodeType: string;
};

const useDebouncedSave = (
  nodeType: string,
  keys: string[],
  initialValue: string,
) => {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<number>(0);

  const saveToBlockProps = useCallback(
    (text: string, immediate: boolean) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(
        () => {
          setDiscourseNodeSetting(nodeType, keys, text);
        },
        immediate ? 0 : 500,
      );
    },
    [nodeType, keys],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      saveToBlockProps(newValue, false);
    },
    [saveToBlockProps],
  );

  const handleBlur = useCallback(() => {
    saveToBlockProps(value, true);
  }, [value, saveToBlockProps]);

  return { value, setValue, handleChange, handleBlur };
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
  error?: string;
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

const ValidatedTextareaPanel = ({
  label,
  description,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  placeholder?: string;
}) => (
  <div className="flex flex-col">
    <Label>
      {label}
      <Description description={description} />
      <TextArea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full"
        style={{ minHeight: 80, resize: "vertical" }}
      />
    </Label>
  </div>
);

const DiscourseNodeSettings = ({ nodeType }: Props) => {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("general");
  const [tagError, setTagError] = useState("");
  const [formatError, setFormatError] = useState("");

  const settings = useMemo<DiscourseNodeSettingsType | undefined>(
    () => getDiscourseNodeSettings(nodeType),
    [nodeType],
  );

  const description = useDebouncedSave(
    nodeType,
    ["description"],
    settings?.description || "",
  );
  const shortcut = useDebouncedSave(
    nodeType,
    ["shortcut"],
    settings?.shortcut || "",
  );
  const tag = useDebouncedSave(nodeType, ["tag"], settings?.tag || "");
  const format = useDebouncedSave(
    nodeType,
    ["format"],
    settings?.format || "",
  );

  // Validate tag/format on changes
  useEffect(() => {
    const { tagError: tErr, formatError: fErr } = validateTagFormat(
      tag.value,
      format.value,
    );
    setTagError(tErr);
    setFormatError(fErr);
  }, [tag.value, format.value]);

  const handleTagBlur = useCallback(() => {
    tag.handleBlur();
  }, [tag]);

  const handleFormatBlur = useCallback(() => {
    format.handleBlur();
  }, [format]);

  if (!settings) {
    return <div className="p-4">Loading node settings...</div>;
  }

  const nodeText = settings.text;
  const tagPlaceholder = generateTagPlaceholder(nodeText, format.value);

  return (
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
            <ValidatedTextareaPanel
              label="Description"
              description={`Describing what the ${nodeText} node represents in your graph.`}
              value={description.value}
              onChange={description.handleChange}
              onBlur={description.handleBlur}
            />
            <ValidatedInputPanel
              label="Shortcut"
              description={`The trigger to quickly create a ${nodeText} page from the node menu.`}
              value={shortcut.value}
              onChange={shortcut.handleChange}
              onBlur={shortcut.handleBlur}
            />
            <ValidatedInputPanel
              label="Tag"
              description={`Designate a hashtag for marking potential ${nodeText}.`}
              value={tag.value}
              onChange={tag.handleChange}
              onBlur={handleTagBlur}
              error={tagError}
              placeholder={tagPlaceholder}
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
              description={`DEPRECATED - Use specification instead. The format ${nodeText} pages should have.`}
              value={format.value}
              onChange={format.handleChange}
              onBlur={handleFormatBlur}
              error={formatError}
            />
            <BlocksPanel
              title="Specification"
              description={`The conditions specified to identify a ${nodeText} node.`}
              uid={settings.specificationUid}
            />
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
              description={`The template that auto fills ${nodeText} page when generated.`}
              uid={settings.templateUid}
            />
          </div>
        }
      />
      <Tab
        id="attributes"
        title="Attributes"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <Attributes
              nodeType={nodeType}
              attributes={settings.attributes}
              overlay={settings.overlay}
            />
          </div>
        }
      />
      <Tab
        id="canvas"
        title="Canvas"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <CanvasSettings
              nodeType={nodeType}
              canvasSettings={settings.canvasSettings}
              graphOverview={settings.graphOverview}
            />
          </div>
        }
      />
      <Tab
        id="index"
        title="Index"
        panel={
          <div className="flex flex-col gap-4 p-1">
            <BlocksPanel
              title="Index"
              description={`Query configuration for indexing ${nodeText} nodes.`}
              uid={settings.indexUid}
            />
          </div>
        }
      />
    </Tabs>
  );
};

export default DiscourseNodeSettings;
