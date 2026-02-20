import {
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Tooltip,
  Icon,
  ControlGroup,
} from "@blueprintjs/core";
import React, { useState, useMemo } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { DiscourseNodeFlagPanel, DiscourseNodeTextPanel } from "./components/BlockPropSettingPanels";
import { setDiscourseNodeSetting } from "~/components/settings/utils/accessors";

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

const DiscourseNodeCanvasSettings = ({ nodeType, uid }: { nodeType: string; uid: string }) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [color, setColor] = useState<string>(() => {
    const color = getSettingValueFromTree({ tree, key: "color" });
    return formatHexColor(color);
  });
  const alias = getSettingValueFromTree({ tree, key: "alias" });
  const [queryBuilderAlias, setQueryBuilderAlias] = useState<string>(() =>
    getSettingValueFromTree({ tree, key: "query-builder-alias" }),
  );
  const [isKeyImage, setIsKeyImage] = useState(
    () => getSettingValueFromTree({ tree, key: "key-image" }) === "true",
  );
  const [keyImageOption, setKeyImageOption] = useState(() =>
    getSettingValueFromTree({ tree, key: "key-image-option" }),
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
              setDiscourseNodeSetting(nodeType, ["canvasSettings", "color"], colorValue);
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
                setDiscourseNodeSetting(nodeType, ["canvasSettings", "color"], "");
              }}
            />
          </Tooltip>
        </ControlGroup>
      </div>
      <DiscourseNodeTextPanel
        nodeType={nodeType}
        title="Display alias"
        description=""
        settingKeys={["canvasSettings", "alias"]}
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
        title="Key Image"
        description="Add an image to the discourse node"
        settingKeys={["canvasSettings", "key-image"]}
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
          setDiscourseNodeSetting(nodeType, ["canvasSettings", "key-image-option"], value);
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
          setDiscourseNodeSetting(nodeType, ["canvasSettings", "query-builder-alias"], val);
        }}
      />
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
