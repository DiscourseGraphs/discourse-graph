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
import setInputSetting from "roamjs-components/util/setInputSetting";
import {
  DiscourseNodeFlagPanel,
  DiscourseNodeTextPanel,
} from "./components/BlockPropSettingPanels";
import {
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "~/components/settings/utils/accessors";
import {
  DISCOURSE_NODE_KEYS,
  CANVAS_KEYS,
} from "~/components/settings/utils/settingKeys";

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

const DiscourseNodeCanvasSettings = ({
  nodeType,
  uid,
}: {
  nodeType: string;
  uid: string;
}) => {
  const [color, setColor] = useState<string>(() => {
    const color =
      getDiscourseNodeSetting<string>(nodeType, [
        DISCOURSE_NODE_KEYS.canvasSettings,
        CANVAS_KEYS.color,
      ]) ?? "";
    return formatHexColor(color);
  });
  const alias =
    getDiscourseNodeSetting<string>(nodeType, [
      DISCOURSE_NODE_KEYS.canvasSettings,
      CANVAS_KEYS.alias,
    ]) ?? "";
  const [queryBuilderAlias, setQueryBuilderAlias] = useState<string>(
    () =>
      getDiscourseNodeSetting<string>(nodeType, [
        DISCOURSE_NODE_KEYS.canvasSettings,
        CANVAS_KEYS.queryBuilderAlias,
      ]) ?? "",
  );
  const [isKeyImage, setIsKeyImage] = useState(
    () =>
      getDiscourseNodeSetting<boolean>(nodeType, [
        DISCOURSE_NODE_KEYS.canvasSettings,
        CANVAS_KEYS.keyImage,
      ]) ?? false,
  );
  const [keyImageOption, setKeyImageOption] = useState(
    () =>
      getDiscourseNodeSetting<string>(nodeType, [
        DISCOURSE_NODE_KEYS.canvasSettings,
        CANVAS_KEYS.keyImageOption,
      ]) ?? "",
  );

  return (
    <div>
      <div className="mb-4">
        <Label style={{ marginBottom: "4px" }}>Color picker</Label>
        <ControlGroup>
          <InputGroup
            style={{ width: 120 }}
            type={"color"}
            value={color}
            onChange={(e) => {
              const colorValue = e.target.value.replace("#", ""); // remove hash to not create roam link
              setColor(e.target.value);
              void setInputSetting({
                blockUid: uid,
                key: "color",
                value: colorValue,
              });
              setDiscourseNodeSetting(
                nodeType,
                [DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.color],
                colorValue,
              );
            }}
          />
          <Tooltip content={color ? "Unset" : "Color not set"}>
            <Icon
              className={"ml-2 align-middle opacity-80"}
              icon={color ? "delete" : "info-sign"}
              onClick={() => {
                setColor("");
                void setInputSetting({
                  blockUid: uid,
                  key: "color",
                  value: "",
                });
                setDiscourseNodeSetting(
                  nodeType,
                  [DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.color],
                  "",
                );
              }}
            />
          </Tooltip>
        </ControlGroup>
      </div>
      <DiscourseNodeTextPanel
        nodeType={nodeType}
        title="Display alias"
        description=""
        settingKeys={[DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.alias]}
        initialValue={alias}
        onChange={(val) => {
          void setInputSetting({
            blockUid: uid,
            key: "alias",
            value: val,
          });
        }}
      />
      <DiscourseNodeFlagPanel
        nodeType={nodeType}
        title="Key image"
        description="Add an image to the discourse node"
        settingKeys={[DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.keyImage]}
        initialValue={isKeyImage}
        onChange={(checked) => {
          setIsKeyImage(checked);
          if (checked && !keyImageOption) setKeyImageOption("first-image");
          void setInputSetting({
            blockUid: uid,
            key: "key-image",
            value: checked ? "true" : "false",
          });
        }}
      />
      <RadioGroup
        disabled={!isKeyImage}
        selectedValue={keyImageOption || "first-image"}
        label="Key image location"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          setKeyImageOption(value);
          void setInputSetting({
            blockUid: uid,
            key: "key-image-option",
            value,
          });
          setDiscourseNodeSetting(
            nodeType,
            [DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.keyImageOption],
            value,
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
          const val = e.target.value;
          setQueryBuilderAlias(val);
          void setInputSetting({
            blockUid: uid,
            key: "query-builder-alias",
            value: val,
          });
          setDiscourseNodeSetting(
            nodeType,
            [DISCOURSE_NODE_KEYS.canvasSettings, CANVAS_KEYS.queryBuilderAlias],
            val,
          );
        }}
      />
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
