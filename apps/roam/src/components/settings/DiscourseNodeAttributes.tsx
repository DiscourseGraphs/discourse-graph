import { Button, InputGroup, Label } from "@blueprintjs/core";
import React, { useRef, useState } from "react";
import createBlock from "roamjs-components/writes/createBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";

type Attribute = {
  uid: string;
  label: string;
  value: string;
};

const NodeAttribute = ({
  uid,
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
          timeoutRef.current = window.setTimeout(() => {
            updateBlock({
              text: e.target.value,
              uid: getFirstChildUidByBlockUid(uid),
            });
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

const NodeAttributes = ({ uid }: { uid: string }) => {
  const [attributes, setAttributes] = useState<Attribute[]>(() =>
    getBasicTreeByParentUid(uid).map((t) => ({
      uid: t.uid,
      label: t.text,
      value: t.children[0]?.text,
    })),
  );
  const [newAttribute, setNewAttribute] = useState("");
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        {attributes.map((a) => (
          <NodeAttribute
            key={a.uid}
            {...a}
            onChange={(v) =>
              setAttributes(
                attributes.map((aa) =>
                  a.uid === aa.uid ? { ...a, value: v } : aa,
                ),
              )
            }
            onDelete={() =>
              deleteBlock(a.uid).then(() =>
                setAttributes(attributes.filter((aa) => a.uid !== aa.uid)),
              )
            }
          />
        ))}
      </div>
      <div>
        <Label style={{ marginBottom: 8 }}>Attribute label</Label>
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
              createBlock({
                node: {
                  text: newAttribute,
                  children: [{ text: DEFAULT }],
                },
                parentUid: uid,
                order: attributes.length,
              }).then((uid) => {
                setAttributes([
                  ...attributes,
                  { uid, label: newAttribute, value: DEFAULT },
                ]);
                setNewAttribute("");
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NodeAttributes;
