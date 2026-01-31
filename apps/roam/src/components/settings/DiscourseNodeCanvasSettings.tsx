import {
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Tooltip,
  Icon,
  ControlGroup,
} from "@blueprintjs/core";
import React, { useState } from "react";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "./utils/accessors";
import { DiscourseNodeFlagPanel } from "./components/BlockPropSettingPanels";

export const formatHexColor = (color: string) => {
  if (!color) return "";
  const COLOR_TEST = /^[0-9a-f]{6}$/i;
  if (color.startsWith("#")) {
    // handle legacy color format
    return color;
  } else if (COLOR_TEST.test(color)) {
    return "#" + color;
  }
  return "";
};

const DiscourseNodeCanvasSettings = ({ nodeType }: { nodeType: string }) => {
  const [color, setColor] = useState<string>(() => {
    const storedColor = getDiscourseNodeSetting<string>(nodeType, [
      "canvasSettings",
      "color",
    ])!;
    return formatHexColor(storedColor);
  });
  const [alias, setAlias] = useState(
    () => getDiscourseNodeSetting<string>(nodeType, ["canvasSettings", "alias"]),
  );
  const [isKeyImage, setIsKeyImage] = useState(() =>
    getDiscourseNodeSetting<boolean>(nodeType, ["canvasSettings", "key-image"]),
  );
  const [keyImageOption, setKeyImageOption] = useState(() =>
    getDiscourseNodeSetting<string>(nodeType, [
      "canvasSettings",
      "key-image-option",
    ]),
  );
  const [queryBuilderAlias, setQueryBuilderAlias] = useState(
    () => getDiscourseNodeSetting<string>(nodeType, ["canvasSettings", "query-builder-alias"]),
  );

  return (
    <div>
      <div className="mb-4">
        <Label style={{ marginBottom: "4px" }}>Color Picker</Label>
        <ControlGroup>
          <InputGroup
            style={{ width: 120 }}
            type={"color"}
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setDiscourseNodeSetting(
                nodeType,
                ["canvasSettings", "color"],
                e.target.value.replace("#", ""), // remove hash to not create roam link
              );
            }}
          />
          <Tooltip content={color ? "Unset" : "Color not set"}>
            <Icon
              className={"ml-2 align-middle opacity-80"}
              icon={color ? "delete" : "info-sign"}
              onClick={() => {
                setColor("");
                setDiscourseNodeSetting(
                  nodeType,
                  ["canvasSettings", "color"],
                  "",
                );
              }}
            />
          </Tooltip>
        </ControlGroup>
      </div>
      <Label style={{ width: 240 }}>
        Display Alias
        <InputGroup
          value={alias}
          onChange={(e) => {
            setAlias(e.target.value);
            setDiscourseNodeSetting(
              nodeType,
              ["canvasSettings", "alias"],
              e.target.value,
            );
          }}
        />
      </Label>
      <DiscourseNodeFlagPanel
        nodeType={nodeType}
        title="Key Image"
        description="Add an image to the discourse node"
        settingKeys={["canvasSettings", "key-image"]}
        defaultValue={false}
        onChange={(checked) => {
          setIsKeyImage(checked);
          if (checked && !keyImageOption) setKeyImageOption("first-image");
        }}
      />
      <RadioGroup
        disabled={!isKeyImage}
        selectedValue={keyImageOption || "first-image"}
        label="Key Image Location"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          setKeyImageOption(value);
          setDiscourseNodeSetting(
            nodeType,
            ["canvasSettings", "key-image-option"],
            value,
          );
        }}
      >
        <Radio label="First image on page" value="first-image" />
        <Radio value="query-builder">
          Query Builder reference
          <Tooltip content={"Use a Query Builder alias or block reference"}>
            <Icon
              icon={"info-sign"}
              iconSize={12}
              className={"ml-2 align-middle opacity-80"}
            />
          </Tooltip>
        </Radio>
      </RadioGroup>
      <InputGroup
        style={{ width: 240 }}
        disabled={keyImageOption !== "query-builder" || !isKeyImage}
        value={queryBuilderAlias}
        onChange={(e) => {
          setQueryBuilderAlias(e.target.value);
          setDiscourseNodeSetting(
            nodeType,
            ["canvasSettings", "query-builder-alias"],
            e.target.value,
          );
        }}
      />
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
