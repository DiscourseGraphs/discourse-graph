import {
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Tooltip,
  Icon,
  ControlGroup,
  Checkbox,
} from "@blueprintjs/core";
import React, { useState } from "react";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "./utils/accessors";

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
  const [alias, setAlias] = useState<string>(() =>
    getDiscourseNodeSetting<string>(nodeType, ["canvasSettings", "alias"])!,
  );
  const [queryBuilderAlias, setQueryBuilderAlias] = useState<string>(() =>
    getDiscourseNodeSetting<string>(nodeType, [
      "canvasSettings",
      "query-builder-alias",
    ])!,
  );
  const [isKeyImage, setIsKeyImage] = useState(() =>
    getDiscourseNodeSetting<boolean>(nodeType, ["canvasSettings", "key-image"])!,
  );
  const [keyImageOption, setKeyImageOption] = useState(() =>
    getDiscourseNodeSetting<string>(nodeType, [
      "canvasSettings",
      "key-image-option",
    ])!,
  );

  return (
    <div>
      <div className="mb-4">
        <Label style={{ marginBottom: "4px" }}>Color picker</Label>
        <ControlGroup>
          <InputGroup
            style={{ width: 120 }}
            type={"color"}
            value={color || "#000000"}
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
        Display alias
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
      <Checkbox
        style={{ width: 240, lineHeight: "normal" }}
        checked={isKeyImage}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setIsKeyImage(target.checked);
          if (target.checked) {
            if (!keyImageOption) setKeyImageOption("first-image");
            setDiscourseNodeSetting(
              nodeType,
              ["canvasSettings", "key-image"],
              true,
            );
          } else {
            setDiscourseNodeSetting(
              nodeType,
              ["canvasSettings", "key-image"],
              false,
            );
          }
        }}
      >
        Key image
        <Tooltip content={"Add an image to the discourse node"}>
          <Icon
            icon={"info-sign"}
            iconSize={12}
            className={"ml-2 align-middle opacity-80"}
          />
        </Tooltip>
      </Checkbox>
      <RadioGroup
        disabled={!isKeyImage}
        selectedValue={keyImageOption || "first-image"}
        label="Key image location"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setKeyImageOption(target.value);
          setDiscourseNodeSetting(
            nodeType,
            ["canvasSettings", "key-image-option"],
            target.value,
          );
        }}
      >
        <Radio label="First image on page" value="first-image" />
        <Radio value="query-builder">
          Query builder reference
          <Tooltip content={"Use a query builder alias or block reference"}>
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
