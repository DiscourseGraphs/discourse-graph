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
import { setDiscourseNodeSetting } from "~/components/settings/block-prop/utils/accessors";

export const formatHexColor = (color: string) => {
  if (!color) return "";
  const COLOR_TEST = /^[0-9a-f]{6}$/i;
  if (color.startsWith("#")) {
    return color;
  } else if (COLOR_TEST.test(color)) {
    return "#" + color;
  }
  return "";
};

type CanvasSettingsProps = {
  nodeType: string;
  canvasSettings: Record<string, string>;
  graphOverview: boolean;
};

const CanvasSettings = ({ nodeType, canvasSettings, graphOverview }: CanvasSettingsProps) => {
  const [color, setColor] = useState<string>(() =>
    formatHexColor(canvasSettings.color || ""),
  );
  const [alias, setAlias] = useState<string>(canvasSettings.alias || "");
  const [queryBuilderAlias, setQueryBuilderAlias] = useState<string>(
    canvasSettings["query-builder-alias"] || "",
  );
  const [isKeyImage, setIsKeyImage] = useState(
    canvasSettings["key-image"] === "true",
  );
  const [keyImageOption, setKeyImageOption] = useState(
    canvasSettings["key-image-option"] || "first-image",
  );
  const [isGraphOverview, setIsGraphOverview] = useState(graphOverview);

  const saveCanvasSetting = (key: string, value: string) => {
    setDiscourseNodeSetting(nodeType, ["canvasSettings", key], value);
  };

  return (
    <div>
      <Checkbox
        className="mb-4"
        checked={isGraphOverview}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setIsGraphOverview(target.checked);
          setDiscourseNodeSetting(nodeType, ["graphOverview"], target.checked);
        }}
      >
        Graph Overview
        <Tooltip content={"Include this node type in the graph overview"}>
          <Icon
            icon={"info-sign"}
            iconSize={12}
            className={"ml-2 align-middle opacity-80"}
          />
        </Tooltip>
      </Checkbox>
      <div className="mb-4">
        <Label style={{ marginBottom: "4px" }}>Color Picker</Label>
        <ControlGroup>
          <InputGroup
            style={{ width: 120 }}
            type={"color"}
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              saveCanvasSetting("color", e.target.value.replace("#", ""));
            }}
          />
          <Tooltip content={color ? "Unset" : "Color not set"}>
            <Icon
              className={"ml-2 align-middle opacity-80"}
              icon={color ? "delete" : "info-sign"}
              onClick={() => {
                setColor("");
                saveCanvasSetting("color", "");
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
            saveCanvasSetting("alias", e.target.value);
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
            saveCanvasSetting("key-image", "true");
          } else {
            saveCanvasSetting("key-image", "false");
          }
        }}
      >
        Key Image
        <Tooltip content={"Add an image to the Discourse Node"}>
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
        label="Key Image Location"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setKeyImageOption(target.value);
          saveCanvasSetting("key-image-option", target.value);
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
          saveCanvasSetting("query-builder-alias", e.target.value);
        }}
      />
    </div>
  );
};

export default CanvasSettings;
