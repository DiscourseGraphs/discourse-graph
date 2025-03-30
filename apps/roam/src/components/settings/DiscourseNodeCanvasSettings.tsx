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
import React, { useState, useMemo } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import setInputSetting from "roamjs-components/util/setInputSetting";

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

const DiscourseNodeCanvasSettings = ({ uid }: { uid: string }) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [color, setColor] = useState<string>(() => {
    const color = getSettingValueFromTree({ tree, key: "color" });
    return formatHexColor(color);
  });
  const [alias, setAlias] = useState<string>(() =>
    getSettingValueFromTree({ tree, key: "alias" }),
  );
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
        <Label style={{ marginBottom: "4px" }}>Color Picker</Label>
        <ControlGroup>
          <InputGroup
            style={{ width: 120 }}
            type={"color"}
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setInputSetting({
                blockUid: uid,
                key: "color",
                value: e.target.value.replace("#", ""), // remove hash to not create roam link
              });
            }}
          />
          <Tooltip content={color ? "Unset" : "Color not set"}>
            <Icon
              className={"ml-2 align-middle opacity-80"}
              icon={color ? "delete" : "info-sign"}
              onClick={() => {
                setColor("");
                setInputSetting({
                  blockUid: uid,
                  key: "color",
                  value: "",
                });
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
            setInputSetting({
              blockUid: uid,
              key: "alias",
              value: e.target.value,
            });
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
            setInputSetting({
              blockUid: uid,
              key: "key-image",
              value: "true",
            });
          } else {
            setInputSetting({
              blockUid: uid,
              key: "key-image",
              value: "false",
            });
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
      {/* </Tooltip> */}
      <RadioGroup
        disabled={!isKeyImage}
        selectedValue={!!keyImageOption ? keyImageOption : "first-image"}
        label="Key Image Location"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setKeyImageOption(target.value);
          setInputSetting({
            blockUid: uid,
            key: "key-image-option",
            value: target.value,
          });
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
          setInputSetting({
            blockUid: uid,
            key: "query-builder-alias",
            value: e.target.value,
          });
        }}
      />
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
