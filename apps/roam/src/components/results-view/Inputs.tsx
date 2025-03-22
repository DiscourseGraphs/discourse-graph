import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getSubTree, setInputSetting } from "roamjs-components/util";
import { type InputValues } from "~/utils/parseResultSettings";
import {
  Button,
  ControlGroup,
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Tooltip,
} from "@blueprintjs/core";
import parseQuery from "~/utils/parseQuery";
import { createBlock, deleteBlock } from "roamjs-components/writes";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { CellEmbed } from "./ResultsTable";
import { InputTextNode } from "roamjs-components/types";
import fuzzy from "fuzzy";

const INPUT_TYPES = ["text", "pages", "smartblock"];

type InputProps = {
  initialInputs: InputValues;
  onRefresh: () => void;
  preventSavingSettings?: boolean;
  parentUid: string;
  resultsNodeUid: string;
  close: () => void;
};

const getOptionsNode = (inputUid: string) => {
  const configNode = getSubTree({ key: "config", parentUid: inputUid });
  const optionsNode = getSubTree({ key: "options", parentUid: configNode.uid });
  return optionsNode;
};

const EmbedOptions = ({ inputUid }: { inputUid: string }) => {
  const optionsNode = getOptionsNode(inputUid);

  const css = `
    .block-embed .block-expand {
      display: none;
    }
    .block-embed .controls.rm-block__controls {
      flex: initial;
      margin-right: 10px;
    }
  `;

  return (
    <div className="pt-4">
      <style>{css}</style>
      <CellEmbed uid={optionsNode.children[0].uid} />
    </div>
  );
};

export const Inputs = ({
  initialInputs,
  onRefresh,
  preventSavingSettings = false,
  parentUid,
  resultsNodeUid,
  close,
}: InputProps) => {
  const [inputs, setInputs] = useState(initialInputs);
  const [showSettings, setShowSettings] = useState(false);
  const [smartBlockOptions, setSmartBlockOptions] = useState<
    Record<string, string[]>
  >({});
  const allPages = useMemo(() => {
    return getAllPageNames();
  }, []);
  const inputsNode = useMemo(
    () => getSubTree({ key: "inputs", parentUid: resultsNodeUid }),
    [resultsNodeUid],
  );
  const hasSpacesInKeys = useMemo(() => {
    return inputs.some((input) => input.key.includes(" "));
  }, [inputs]);

  const getSmartBlockOptions = async (inputUid: string): Promise<string[]> => {
    const optionsNode = getOptionsNode(inputUid);
    if (!window.roamjs?.extension?.smartblocks)
      return ["SmartBlocks not enabled."];

    try {
      const results =
        (await window.roamjs.extension.smartblocks.triggerSmartblock({
          srcUid: optionsNode.uid,
        })) as InputTextNode[];

      const options = results.map((t) => t.text || "");
      setSmartBlockOptions((prev) => ({
        ...prev,
        [inputUid]: options,
      }));
      return options;
    } catch (error) {
      console.error("Error loading SmartBlock options:", error);
      return ["Error loading SmartBlock options"];
    }
  };

  const handleInputTypeChange = useCallback(
    (inputKey: string, newType: string) => {
      const newInputs: InputValues = inputs.map((i) =>
        i.key === inputKey ? { ...i, options: newType } : i,
      );
      setInputs(newInputs);

      if (preventSavingSettings) return;

      const input = newInputs.find((i) => i.key === inputKey);
      const configNode = getSubTree({ key: "config", parentUid: input?.uid });
      if (input) {
        setInputSetting({
          blockUid: configNode.uid,
          key: "options",
          value:
            newType === "smartblock" ? "<%QUERYBUILDER:someQuery%>" : newType,
        });
      }
    },
    [inputs, preventSavingSettings],
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

  // create initial blocks, set initial inputs
  useEffect(() => {
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
  }, []);

  // load smart block options for all inputs when settings change
  useEffect(() => {
    if (showSettings) return;

    const loadAllSmartBlockOptions = async () => {
      const smartBlockInputs = inputs.filter(
        (input) => input.options === "smartblock",
      );

      const newCache: Record<string, string[]> = {};

      await Promise.all(
        smartBlockInputs.map(async (input) => {
          const options = await getSmartBlockOptions(input.uid);
          newCache[input.uid] = options;
        }),
      );

      setSmartBlockOptions(newCache);
    };

    loadAllSmartBlockOptions();
  }, [showSettings]);

  return (
    <div className="relative w-full">
      <div className="absolute right-2 top-2 z-10">
        <Tooltip
          content={showSettings ? "" : "Input Options"}
          hoverOpenDelay={500}
        >
          <Button
            className="focus:outline-none"
            rightIcon={showSettings ? "tick-circle" : "cog"}
            intent={showSettings ? "success" : "none"}
            text={showSettings ? "Save Options" : ""}
            minimal
            small
            onClick={() => {
              setShowSettings(!showSettings);
            }}
            disabled={!inputs.length}
          />
        </Tooltip>
        <Tooltip content="Close">
          <Button
            icon="cross"
            minimal
            small
            onClick={close}
            hidden={!!inputs.length}
          />
        </Tooltip>
      </div>
      <div className="absolute bottom-2 right-2 z-10">
        <Button
          hidden={!showSettings}
          rightIcon="cross"
          text={"Close Inputs Panel"}
          minimal
          small
          intent="danger"
          onClick={close}
        />
      </div>

      <div className="w-full p-4" style={{ backgroundColor: "#EEE" }}>
        {hasSpacesInKeys && (
          <div className="mx-auto mb-4 w-4/5 rounded border border-red-400 bg-red-100 p-2 text-center text-red-700">
            <strong>Warning:</strong> Some input variables contain spaces, which
            will cause issues. Please rename your input variables to remove
            spaces.
          </div>
        )}
        {inputs.length === 0 && <>No Inputs Found</>}
        {inputs.map((input) => (
          <ControlGroup
            key={input.uid}
            className="mb-4"
            fill={false}
            vertical={true}
          >
            <Label>{input.key}</Label>

            {showSettings ? (
              <>
                <RadioGroup
                  className="flex items-center gap-4"
                  selectedValue={input.options}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement;
                    handleInputTypeChange(input.key, target.value);
                  }}
                >
                  {INPUT_TYPES.map((type) => (
                    <Radio
                      key={type}
                      label={type}
                      value={type}
                      className="font-normal"
                    />
                  ))}
                </RadioGroup>

                {input.options === "smartblock" && (
                  <EmbedOptions inputUid={input.uid} />
                )}
              </>
            ) : input.options === "pages" || input.options === "smartblock" ? (
              <MenuItemSelect
                activeItem={input.inputValue}
                itemListPredicate={(query: string, items: string[]) => {
                  let filtered = items;
                  if (query) {
                    filtered = fuzzy
                      .filter(query, items, { extract: (item) => String(item) })
                      .map((f) => f.original)
                      .filter((f): f is string => !!f);
                  }
                  if (filtered.length > 50) {
                    return filtered
                      .slice(0, 50)
                      .concat("Only first 50 shown ...");
                  }
                  return filtered;
                }}
                items={
                  input.options === "pages"
                    ? allPages
                    : smartBlockOptions[input.uid] || ["An Error Occured"]
                }
                filterable={true}
                fill={true}
                onItemSelect={async (item) => {
                  const newInputs: InputValues = inputs.map((i) =>
                    i.key === input.key ? { ...i, inputValue: item } : i,
                  );
                  setInputs(newInputs);
                  if (preventSavingSettings) return;
                  await setInputSetting({
                    blockUid: input.uid,
                    key: "value",
                    value: item,
                  });
                  onRefresh();
                }}
              />
            ) : input.options === "text" ? (
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
            ) : null}
          </ControlGroup>
        ))}
      </div>
    </div>
  );
};
