import React, { useState } from "react";
import {
  Checkbox,
  InputGroup,
  Label,
  NumericInput,
  HTMLSelect,
  Button,
  Tag,
} from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import idToTitle from "roamjs-components/util/idToTitle";
import { getGlobalSetting, setGlobalSetting } from "../utils/accessors";

type BaseProps = {
  title: string;
  description: string;
  settingKeys: string[];
};

export const BlockPropTextPanel = ({
  title,
  description,
  settingKeys,
  defaultValue = "",
  placeholder,
}: BaseProps & {
  defaultValue?: string;
  placeholder?: string;
}) => {
  const [value, setValue] = useState(
    () => getGlobalSetting<string>(settingKeys) ?? defaultValue,
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setGlobalSetting(settingKeys, newValue);
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <InputGroup
        value={value}
        onChange={handleChange}
        placeholder={placeholder || defaultValue}
      />
    </Label>
  );
};

export const BlockPropFlagPanel = ({
  title,
  description,
  settingKeys,
  defaultValue = false,
  disabled = false,
  onChange,
}: BaseProps & {
  defaultValue?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) => {
  const [value, setValue] = useState(
    () => getGlobalSetting<boolean>(settingKeys) ?? defaultValue,
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setValue(checked);
    setGlobalSetting(settingKeys, checked);
    onChange?.(checked);
  };

  return (
    <Checkbox
      checked={value}
      onChange={handleChange}
      disabled={disabled}
      labelElement={
        <>
          {idToTitle(title)}
          <Description description={description} />
        </>
      }
    />
  );
};

export const BlockPropNumberPanel = ({
  title,
  description,
  settingKeys,
  defaultValue = 0,
  min,
  max,
}: BaseProps & {
  defaultValue?: number;
  min?: number;
  max?: number;
}) => {
  const [value, setValue] = useState(
    () => getGlobalSetting<number>(settingKeys) ?? defaultValue,
  );

  const handleChange = (valueAsNumber: number) => {
    setValue(valueAsNumber);
    setGlobalSetting(settingKeys, valueAsNumber);
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <NumericInput
        value={value}
        onValueChange={handleChange}
        min={min}
        max={max}
        fill
      />
    </Label>
  );
};

export const BlockPropSelectPanel = ({
  title,
  description,
  settingKeys,
  options,
  defaultValue,
}: BaseProps & {
  options: string[];
  defaultValue?: string;
}) => {
  const [value, setValue] = useState(
    () => getGlobalSetting<string>(settingKeys) ?? defaultValue ?? options[0],
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setGlobalSetting(settingKeys, newValue);
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <HTMLSelect value={value} onChange={handleChange} fill options={options} />
    </Label>
  );
};

export const BlockPropMultiTextPanel = ({
  title,
  description,
  settingKeys,
  defaultValue = [],
}: BaseProps & {
  defaultValue?: string[];
}) => {
  const [values, setValues] = useState<string[]>(
    () => getGlobalSetting<string[]>(settingKeys) ?? defaultValue,
  );
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    if (inputValue.trim() && !values.includes(inputValue.trim())) {
      const newValues = [...values, inputValue.trim()];
      setValues(newValues);
      setGlobalSetting(settingKeys, newValues);
      setInputValue("");
    }
  };

  const handleRemove = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    setValues(newValues);
    setGlobalSetting(settingKeys, newValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <div className="flex gap-2">
        <InputGroup
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new item..."
          className="flex-grow"
        />
        <Button icon="plus" onClick={handleAdd} disabled={!inputValue.trim()} />
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {values.map((v, i) => (
            <Tag key={i} onRemove={() => handleRemove(i)} minimal>
              {v}
            </Tag>
          ))}
        </div>
      )}
    </Label>
  );
};
