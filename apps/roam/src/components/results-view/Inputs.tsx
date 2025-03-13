import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getSubTree, setInputSetting } from "roamjs-components/util";
import { type InputValues } from "~/utils/parseResultSettings";
import { InputGroup, Label } from "@blueprintjs/core";
import parseQuery from "~/utils/parseQuery";
import { createBlock, deleteBlock } from "roamjs-components/writes";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";

type InputProps = {
  show: boolean;
  initialInputs: InputValues;
  onRefresh: () => void;
  preventSavingSettings?: boolean;
  parentUid: string;
  resultsNodeUid: string;
};

export const Inputs = ({
  show,
  initialInputs,
  onRefresh,
  preventSavingSettings = false,
  parentUid,
  resultsNodeUid,
}: InputProps) => {
  const [inputs, setInputs] = useState(initialInputs);
  const allPages = useMemo(() => {
    return getAllPageNames();
  }, []);
  const inputsNode = useMemo(
    () => getSubTree({ key: "inputs", parentUid: resultsNodeUid }),
    [resultsNodeUid],
  );

  const createConfigBlocks = useCallback(
    async (inputs: InputValues) => {
      if (preventSavingSettings) return;
      const inputsToCreate = inputs
        .map((input) => ({
          uid: input.uid,
          text: input.key,
          children: [
            {
              text: `value`,
              children: [{ text: input.inputValue }],
            },
            {
              text: `config`,
              children: [
                { text: `options`, children: [{ text: input.options }] },
              ],
            },
          ],
        }))
        .filter(
          (input) => !inputsNode.children.find((c) => c.uid === input.uid),
        );
      const inputsToDelete = inputsNode.children.filter(
        (node) => !inputs.find((input) => input.uid === node.uid),
      );

      inputsToDelete.forEach((node) => deleteBlock(node.uid));
      inputsToCreate.forEach((node) =>
        createBlock({
          parentUid: inputsNode.uid,
          node,
        }),
      );
    },
    [setInputs, preventSavingSettings, parentUid],
  );

  useEffect(() => {
    if (!show) return;

    const getExpectedInputs = () => {
      return parseQuery(parentUid)
        .conditions.flatMap((c) =>
          c.type === "clause" || c.type === "not"
            ? [c.target]
            : c.conditions
                .flat()
                .map((cc) =>
                  cc.type === "clause" || cc.type === "not" ? cc.target : "",
                ),
        )
        .filter((t) => /^:in /.test(t))
        .map((t) => t.substring(4));
    };

    const newInputs = getExpectedInputs().map((key) => {
      const existingInput = inputs.find((i) => i.key === key);
      return (
        existingInput || {
          uid: window.roamAlphaAPI.util.generateUID(),
          key,
          inputValue: "",
          options: "text",
        }
      );
    });
    createConfigBlocks(newInputs);
    setInputs(newInputs);
  }, [show]);
  if (!show) return null;
  return (
    <div className="w-full p-4" style={{ backgroundColor: "#EEE" }}>
      {inputs.map((input) => (
        <div key={input.key} className="mb-2">
          <Label>
            {input.key}
            {input.options === "pages" ? (
              <MenuItemSelect
                activeItem={input.inputValue}
                itemListPredicate={(query: string, items: string[]) => {
                  let filtered = items;
                  if (query) {
                    filtered = items.filter((item) => {
                      return String(item)
                        .toLowerCase()
                        .includes(query.toLowerCase());
                    });
                  }
                  if (filtered.length > 50) {
                    return filtered
                      .slice(0, 50)
                      .concat("Only first 50 shown ...");
                  }
                  return filtered;
                }}
                items={allPages}
                filterable={true}
                fill={true}
                onItemSelect={(item) => {
                  const newInputs: InputValues = inputs.map((i) =>
                    i.key === input.key ? { ...i, inputValue: item } : i,
                  );
                  setInputs(newInputs);
                  if (preventSavingSettings) return;
                  setInputSetting({
                    blockUid: input.uid,
                    key: "value",
                    value: item,
                  });
                }}
              />
            ) : (
              <InputGroup
                value={input.inputValue}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRefresh();
                }}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const newInputs: InputValues = inputs.map((i) =>
                    i.key === input.key ? { ...i, inputValue: newValue } : i,
                  );
                  setInputs(newInputs);
                  if (preventSavingSettings) return;
                  setInputSetting({
                    blockUid: input.uid,
                    key: "value",
                    value: newValue,
                  });
                }}
              />
            )}
          </Label>
        </div>
      ))}
    </div>
  );
};
