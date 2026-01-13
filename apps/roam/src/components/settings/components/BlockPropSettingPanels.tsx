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
import {
  getGlobalSetting,
  setGlobalSetting,
  getPersonalSetting,
  setPersonalSetting,
  getFeatureFlag,
  setFeatureFlag,
  getDiscourseNodeSetting,
  setDiscourseNodeSetting,
} from "../utils/accessors";
import type { json } from "~/utils/getBlockProps";
import type { FeatureFlags } from "../utils/zodSchema";

type Getter = <T>(keys: string[]) => T | undefined;
type Setter = (keys: string[], value: json) => void;

type BaseProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: Getter;
  setter: Setter;
};


export const BaseTextPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = "",
  placeholder,
}: BaseProps & {
  defaultValue?: string;
  placeholder?: string;
}) => {
  const [value, setValue] = useState(
    () => getter<string>(settingKeys) ?? defaultValue,
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setter(settingKeys, newValue);
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

export const BaseFlagPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = false,
  disabled = false,
  onBeforeChange,
  onChange,
}: BaseProps & {
  defaultValue?: boolean;
  disabled?: boolean;
  onBeforeChange?: (checked: boolean) => Promise<boolean>;
  onChange?: (checked: boolean) => void;
}) => {
  const [value, setValue] = useState(
    () => getter<boolean>(settingKeys) ?? defaultValue,
  );

  const handleChange = async (e: React.FormEvent<HTMLInputElement>) => {
    const { checked } = e.target as HTMLInputElement;

    if (onBeforeChange) {
      const shouldProceed = await onBeforeChange(checked);
      if (!shouldProceed) return;
    }

    setValue(checked);
    setter(settingKeys, checked);
    onChange?.(checked);
  };

  return (
    <Checkbox
      checked={value}
      onChange={(e) => void handleChange(e)}
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

export const BaseNumberPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = 0,
  min,
  max,
}: BaseProps & {
  defaultValue?: number;
  min?: number;
  max?: number;
}) => {
  const [value, setValue] = useState(
    () => getter<number>(settingKeys) ?? defaultValue,
  );

  const handleChange = (valueAsNumber: number) => {
    setValue(valueAsNumber);
    setter(settingKeys, valueAsNumber);
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

export const BaseSelectPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  options,
  defaultValue,
}: BaseProps & {
  options: string[];
  defaultValue?: string;
}) => {
  const [value, setValue] = useState(
    () => getter<string>(settingKeys) ?? defaultValue ?? options[0],
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setter(settingKeys, newValue);
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <HTMLSelect value={value} onChange={handleChange} fill options={options} />
    </Label>
  );
};

export const BaseMultiTextPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = [],
}: BaseProps & {
  defaultValue?: string[];
}) => {
  const [values, setValues] = useState<string[]>(
    () => getter<string[]>(settingKeys) ?? defaultValue,
  );
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    if (inputValue.trim() && !values.includes(inputValue.trim())) {
      const newValues = [...values, inputValue.trim()];
      setValues(newValues);
      setter(settingKeys, newValues);
      setInputValue("");
    }
  };

  const handleRemove = (index: number) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const newValues = values.filter((_, i) => i !== index);
    setValues(newValues);
    setter(settingKeys, newValues);
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

type WrapperProps = Omit<BaseProps, "getter" | "setter">;

const featureFlagGetter = <T,>(keys: string[]): T | undefined =>
  getFeatureFlag(keys[0] as keyof FeatureFlags) as T | undefined;

const featureFlagSetter = (keys: string[], value: json): void =>
  setFeatureFlag(keys[0] as keyof FeatureFlags, value as boolean);

export const FeatureFlagPanel = ({
  title,
  description,
  featureKey,
  onBeforeEnable,
  onAfterChange,
}: {
  title: string;
  description: string;
  featureKey: keyof FeatureFlags;
  onBeforeEnable?: () => Promise<boolean>;
  onAfterChange?: (checked: boolean) => void;
}) => (
  <BaseFlagPanel
    title={title}
    description={description}
    settingKeys={[featureKey]}
    getter={featureFlagGetter}
    setter={featureFlagSetter}
    onBeforeChange={onBeforeEnable ? (checked) => (checked ? onBeforeEnable() : Promise.resolve(true)) : undefined}
    onChange={onAfterChange}
  />
);

export const GlobalTextPanel = (
  props: WrapperProps & { defaultValue?: string; placeholder?: string },
) => <BaseTextPanel {...props} getter={getGlobalSetting} setter={setGlobalSetting} />;

export const GlobalFlagPanel = (
  props: WrapperProps & {
    defaultValue?: boolean;
    disabled?: boolean;
    onBeforeChange?: (checked: boolean) => Promise<boolean>;
    onChange?: (checked: boolean) => void;
  },
) => <BaseFlagPanel {...props} getter={getGlobalSetting} setter={setGlobalSetting} />;

export const GlobalNumberPanel = (
  props: WrapperProps & { defaultValue?: number; min?: number; max?: number },
) => <BaseNumberPanel {...props} getter={getGlobalSetting} setter={setGlobalSetting} />;

export const GlobalSelectPanel = (
  props: WrapperProps & { options: string[]; defaultValue?: string },
) => <BaseSelectPanel {...props} getter={getGlobalSetting} setter={setGlobalSetting} />;

export const GlobalMultiTextPanel = (
  props: WrapperProps & { defaultValue?: string[] },
) => <BaseMultiTextPanel {...props} getter={getGlobalSetting} setter={setGlobalSetting} />;

export const PersonalTextPanel = (
  props: WrapperProps & { defaultValue?: string; placeholder?: string },
) => <BaseTextPanel {...props} getter={getPersonalSetting} setter={setPersonalSetting} />;

export const PersonalFlagPanel = (
  props: WrapperProps & {
    defaultValue?: boolean;
    disabled?: boolean;
    onBeforeChange?: (checked: boolean) => Promise<boolean>;
    onChange?: (checked: boolean) => void;
  },
) => <BaseFlagPanel {...props} getter={getPersonalSetting} setter={setPersonalSetting} />;

export const PersonalNumberPanel = (
  props: WrapperProps & { defaultValue?: number; min?: number; max?: number },
) => <BaseNumberPanel {...props} getter={getPersonalSetting} setter={setPersonalSetting} />;

export const PersonalSelectPanel = (
  props: WrapperProps & { options: string[]; defaultValue?: string },
) => <BaseSelectPanel {...props} getter={getPersonalSetting} setter={setPersonalSetting} />;

export const PersonalMultiTextPanel = (
  props: WrapperProps & { defaultValue?: string[] },
) => <BaseMultiTextPanel {...props} getter={getPersonalSetting} setter={setPersonalSetting} />;

const createDiscourseNodeGetter =
  (nodeType: string) =>
  <T,>(keys: string[]): T | undefined =>
    getDiscourseNodeSetting<T>(nodeType, keys);

const createDiscourseNodeSetter =
  (nodeType: string) =>
  (keys: string[], value: json): void =>
    setDiscourseNodeSetting(nodeType, keys, value);

type DiscourseNodeWrapperProps = WrapperProps & {
  nodeType: string;
};

export const DiscourseNodeTextPanel = ({
  nodeType,
  ...props
}: DiscourseNodeWrapperProps & { defaultValue?: string; placeholder?: string }) => (
  <BaseTextPanel
    {...props}
    getter={createDiscourseNodeGetter(nodeType)}
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeFlagPanel = ({
  nodeType,
  ...props
}: DiscourseNodeWrapperProps & {
  defaultValue?: boolean;
  disabled?: boolean;
  onBeforeChange?: (checked: boolean) => Promise<boolean>;
  onChange?: (checked: boolean) => void;
}) => (
  <BaseFlagPanel
    {...props}
    getter={createDiscourseNodeGetter(nodeType)}
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeSelectPanel = ({
  nodeType,
  ...props
}: DiscourseNodeWrapperProps & { options: string[]; defaultValue?: string }) => (
  <BaseSelectPanel
    {...props}
    getter={createDiscourseNodeGetter(nodeType)}
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeNumberPanel = ({
  nodeType,
  ...props
}: DiscourseNodeWrapperProps & { defaultValue?: number; min?: number; max?: number }) => (
  <BaseNumberPanel
    {...props}
    getter={createDiscourseNodeGetter(nodeType)}
    setter={createDiscourseNodeSetter(nodeType)}
  />
);
