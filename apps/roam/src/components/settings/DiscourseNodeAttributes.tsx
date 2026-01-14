import { Button, InputGroup, Label, HTMLSelect } from "@blueprintjs/core";
import React, { useRef, useState } from "react";
import Description from "roamjs-components/components/Description";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "./utils/accessors";

type AttributeEntry = {
  label: string;
  value: string;
};

const NodeAttribute = ({
  label,
  value,
  onChange,
  onDelete,
}: AttributeEntry & { onChange: (v: string) => void; onDelete: () => void }) => {
  const timeoutRef = useRef(0);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Label style={{ minWidth: 120 }}>{label}</Label>
      <InputGroup
        value={value}
        className="roamjs-attribute-value"
        onChange={(e) => {
          clearTimeout(timeoutRef.current);
          const newValue = e.target.value;
          onChange(newValue);
          timeoutRef.current = window.setTimeout(() => {
            // onChange already updates the parent state which saves
          }, 500);
        }}
      />
      <Button
        icon={"delete"}
        style={{ minWidth: 32 }}
        onClick={onDelete}
        minimal
      />
    </div>
  );
};

const NodeAttributes = ({ nodeType }: { nodeType: string }) => {
  const [attributes, setAttributes] = useState<AttributeEntry[]>(() => {
    const record =
      getDiscourseNodeSetting<Record<string, string>>(nodeType, [
        "attributes",
      ]) ?? {};
    return Object.entries(record).map(([label, value]) => ({ label, value }));
  });
  const [newAttribute, setNewAttribute] = useState("");

  const saveAttributes = (newAttributes: AttributeEntry[]) => {
    const record: Record<string, string> = {};
    for (const attr of newAttributes) {
      record[attr.label] = attr.value;
    }
    setDiscourseNodeSetting(nodeType, ["attributes"], record);
  };

  const handleChange = (label: string, newValue: string) => {
    const newAttributes = attributes.map((a) =>
      a.label === label ? { ...a, value: newValue } : a,
    );
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
  };

  const handleDelete = (label: string) => {
    const newAttributes = attributes.filter((a) => a.label !== label);
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
  };

  const handleAdd = () => {
    if (!newAttribute.trim()) return;
    const DEFAULT = "{count:Has Any Relation To:any}";
    const newAttributes = [
      ...attributes,
      { label: newAttribute.trim(), value: DEFAULT },
    ];
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
    setNewAttribute("");
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        {attributes.map((a) => (
          <NodeAttribute
            key={a.label}
            label={a.label}
            value={a.value}
            onChange={(v) => handleChange(a.label, v)}
            onDelete={() => handleDelete(a.label)}
          />
        ))}
      </div>
      <div>
        <Label style={{ marginBottom: 8 }}>Attribute Label</Label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <InputGroup
            value={newAttribute}
            onChange={(e) => setNewAttribute(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAdd();
              }
            }}
          />
          <Button
            text={"Add"}
            rightIcon={"plus"}
            style={{ marginLeft: 16 }}
            onClick={handleAdd}
            disabled={!newAttribute.trim()}
          />
        </div>
      </div>
    </div>
  );
};

export const DiscourseNodeAttributesTab = ({
  nodeType,
}: {
  nodeType: string;
}) => {
  const [attributes, setAttributes] = useState<AttributeEntry[]>(() => {
    const record =
      getDiscourseNodeSetting<Record<string, string>>(nodeType, [
        "attributes",
      ]) ?? {};
    return Object.entries(record).map(([label, value]) => ({ label, value }));
  });
  const [newAttribute, setNewAttribute] = useState("");
  const [overlay, setOverlay] = useState<string>(
    () => getDiscourseNodeSetting<string>(nodeType, ["overlay"]) ?? "",
  );

  const saveAttributes = (newAttributes: AttributeEntry[]) => {
    const record: Record<string, string> = {};
    for (const attr of newAttributes) {
      record[attr.label] = attr.value;
    }
    setDiscourseNodeSetting(nodeType, ["attributes"], record);
  };

  const handleChange = (label: string, newValue: string) => {
    const newAttributes = attributes.map((a) =>
      a.label === label ? { ...a, value: newValue } : a,
    );
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
  };

  const handleDelete = (label: string) => {
    const newAttributes = attributes.filter((a) => a.label !== label);
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
    // Clear overlay if deleted attribute was selected
    if (overlay === label) {
      setOverlay("");
      setDiscourseNodeSetting(nodeType, ["overlay"], "");
    }
  };

  const handleAdd = () => {
    if (!newAttribute.trim()) return;
    const DEFAULT = "{count:Has Any Relation To:any}";
    const newAttributes = [
      ...attributes,
      { label: newAttribute.trim(), value: DEFAULT },
    ];
    setAttributes(newAttributes);
    saveAttributes(newAttributes);
    setNewAttribute("");
  };

  const handleOverlayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setOverlay(newValue);
    setDiscourseNodeSetting(nodeType, ["overlay"], newValue);
  };

  const attributeLabels = attributes.map((a) => a.label);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div style={{ marginBottom: 32 }}>
          {attributes.map((a) => (
            <NodeAttribute
              key={a.label}
              label={a.label}
              value={a.value}
              onChange={(v) => handleChange(a.label, v)}
              onDelete={() => handleDelete(a.label)}
            />
          ))}
        </div>
        <div>
          <Label style={{ marginBottom: 8 }}>Attribute Label</Label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <InputGroup
              value={newAttribute}
              onChange={(e) => setNewAttribute(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAdd();
                }
              }}
            />
            <Button
              text={"Add"}
              rightIcon={"plus"}
              style={{ marginLeft: 16 }}
              onClick={handleAdd}
              disabled={!newAttribute.trim()}
            />
          </div>
        </div>
      </div>
      <Label>
        Overlay
        <Description description="Select which attribute is used for the Discourse Overlay" />
        <HTMLSelect
          value={overlay}
          onChange={handleOverlayChange}
          fill
          options={["", ...attributeLabels]}
        />
      </Label>
    </div>
  );
};

export default NodeAttributes;
