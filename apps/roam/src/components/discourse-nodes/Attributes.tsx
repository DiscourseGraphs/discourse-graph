import { Button, InputGroup, Label, HTMLSelect } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import React, { useRef, useState } from "react";
import { setDiscourseNodeSetting } from "~/components/settings/block-prop/utils/accessors";

type Attribute = {
  label: string;
  value: string;
};

const NodeAttribute = ({
  label,
  value,
  onChange,
  onDelete,
}: Attribute & { onChange: (v: string) => void; onDelete: () => void }) => {
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
          onChange(e.target.value);
          timeoutRef.current = window.setTimeout(() => {}, 500);
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

type AttributesProps = {
  nodeType: string;
  attributes: Record<string, string>;
  overlay: string;
};

const Attributes = ({ nodeType, attributes, overlay }: AttributesProps) => {
  const [localAttributes, setLocalAttributes] = useState<Attribute[]>(() =>
    Object.entries(attributes).map(([label, value]) => ({ label, value })),
  );
  const [newAttribute, setNewAttribute] = useState("");
  const [selectedOverlay, setSelectedOverlay] = useState(overlay);
  const timeoutRef = useRef(0);

  const saveAttribute = (label: string, value: string) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setDiscourseNodeSetting(nodeType, ["attributes", label], value);
    }, 500);
  };

  const deleteAttribute = (label: string) => {
    const newAttrs = { ...attributes };
    delete newAttrs[label];
    setDiscourseNodeSetting(nodeType, ["attributes"], newAttrs);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        {localAttributes.map((a) => (
          <NodeAttribute
            key={a.label}
            {...a}
            onChange={(v) => {
              saveAttribute(a.label, v);
              setLocalAttributes(
                localAttributes.map((aa) =>
                  a.label === aa.label ? { ...a, value: v } : aa,
                ),
              );
            }}
            onDelete={() => {
              deleteAttribute(a.label);
              setLocalAttributes(
                localAttributes.filter((aa) => a.label !== aa.label),
              );
            }}
          />
        ))}
      </div>
      <div>
        <Label style={{ marginBottom: 8 }}>Attribute Label</Label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <InputGroup
            value={newAttribute}
            onChange={(e) => setNewAttribute(e.target.value)}
          />
          <Button
            text={"Add"}
            rightIcon={"plus"}
            style={{ marginLeft: 16 }}
            onClick={() => {
              const DEFAULT = "{count:Has Any Relation To:any}";
              setDiscourseNodeSetting(nodeType, ["attributes", newAttribute], DEFAULT);
              setLocalAttributes([
                ...localAttributes,
                { label: newAttribute, value: DEFAULT },
              ]);
              setNewAttribute("");
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Label>
          Overlay
          <Description description="Select which attribute is used for the Discourse Overlay" />
          <HTMLSelect
            value={selectedOverlay}
            onChange={(e) => {
              setDiscourseNodeSetting(nodeType, ["overlay"], e.target.value);
              setSelectedOverlay(e.target.value);
            }}
            options={["", ...localAttributes.map((a) => a.label)]}
          />
        </Label>
      </div>
    </div>
  );
};

export default Attributes;
