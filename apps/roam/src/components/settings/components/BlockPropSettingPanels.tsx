import React, { type ChangeEvent, useState, useCallback, useRef } from "react";
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
import useSingleChildValue from "roamjs-components/components/ConfigPanels/useSingleChildValue";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import {
  getGlobalSetting,
  setGlobalSetting,
  getPersonalSetting,
  setPersonalSetting,
  getFeatureFlag,
  setFeatureFlag,
} from "~/components/settings/utils/accessors";
import type { FeatureFlags } from "~/components/settings/utils/zodSchema";

type RoamBlockSyncProps = {
  parentUid?: string;
  uid?: string;
  order?: number;
};

type TextGetter = (keys: string[]) => string | undefined;
type TextSetter = (keys: string[], value: string) => void;

type FlagGetter = (keys: string[]) => boolean | undefined;
type FlagSetter = (keys: string[], value: boolean) => void;

type NumberGetter = (keys: string[]) => number | undefined;
type NumberSetter = (keys: string[], value: number) => void;

type MultiTextGetter = (keys: string[]) => string[] | undefined;
type MultiTextSetter = (keys: string[], value: string[]) => void;

type BaseTextPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: TextGetter;
  setter: TextSetter;
  defaultValue?: string;
  placeholder?: string;
} & RoamBlockSyncProps;

type BaseFlagPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: FlagGetter;
  setter: FlagSetter;
  defaultValue?: boolean;
  disabled?: boolean;
  onBeforeChange?: (checked: boolean) => Promise<boolean>;
  onChange?: (checked: boolean) => void;
} & RoamBlockSyncProps;

type BaseNumberPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: NumberGetter;
  setter: NumberSetter;
  defaultValue?: number;
  min?: number;
  max?: number;
} & RoamBlockSyncProps;

type BaseSelectPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: TextGetter;
  setter: TextSetter;
  options: string[];
  defaultValue?: string;
} & RoamBlockSyncProps;

type BaseMultiTextPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  getter: MultiTextGetter;
  setter: MultiTextSetter;
  defaultValue?: string[];
} & RoamBlockSyncProps;

const BaseTextPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = "",
  placeholder,
  parentUid,
  uid,
  order,
}: BaseTextPanelProps) => {
  const [value, setValue] = useState(() => getter(settingKeys) ?? defaultValue);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue,
    transform: (s: string) => s,
    toStr: (s: string) => s,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setter(settingKeys, newValue);
    syncToBlock?.(newValue);
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

const BaseFlagPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = false,
  disabled = false,
  onBeforeChange,
  onChange,
  parentUid,
  uid: initialBlockUid,
  order,
}: BaseFlagPanelProps) => {
  const [value, setValue] = useState(() => getter(settingKeys) ?? defaultValue);
  const blockUidRef = useRef(initialBlockUid);

  const syncFlagToBlock = useCallback(
    async (checked: boolean) => {
      if (parentUid === undefined || order === undefined) return;
      if (checked) {
        if (blockUidRef.current) return;
        const newUid = window.roamAlphaAPI.util.generateUID();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        await window.roamAlphaAPI.createBlock({
          block: { string: title, uid: newUid },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          location: { order, "parent-uid": parentUid },
        });
        blockUidRef.current = newUid;
      } else if (blockUidRef.current) {
        await window.roamAlphaAPI.deleteBlock({
          block: { uid: blockUidRef.current },
        });
        blockUidRef.current = undefined;
      }
    },
    [title, parentUid, order],
  );

  const handleChange = async (e: React.FormEvent<HTMLInputElement>) => {
    const { checked } = e.target as HTMLInputElement;

    if (onBeforeChange) {
      const shouldProceed = await onBeforeChange(checked);
      if (!shouldProceed) return;
    }

    setValue(checked);
    setter(settingKeys, checked);
    await syncFlagToBlock(checked);
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

const BaseNumberPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = 0,
  min,
  max,
  parentUid,
  uid,
  order,
}: BaseNumberPanelProps) => {
  const [value, setValue] = useState(() => getter(settingKeys) ?? defaultValue);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue,
    transform: (s: string) => parseInt(s, 10),
    toStr: (v: number) => `${v}`,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (valueAsNumber: number) => {
    if (Number.isNaN(valueAsNumber)) return;
    setValue(valueAsNumber);
    setter(settingKeys, valueAsNumber);
    syncToBlock?.(valueAsNumber);
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

const BaseSelectPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  options,
  defaultValue,
  parentUid,
  uid,
  order,
}: BaseSelectPanelProps) => {
  const [value, setValue] = useState(
    () => getter(settingKeys) ?? defaultValue ?? options[0],
  );
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: defaultValue ?? options[0] ?? "",
    transform: (s: string) => s,
    toStr: (s: string) => s,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setter(settingKeys, newValue);
    syncToBlock?.(newValue);
  };

  return (
    <Label>
      {idToTitle(title)}
      <Description description={description} />
      <HTMLSelect
        value={value}
        onChange={handleChange}
        fill
        options={options}
      />
    </Label>
  );
};

const BaseMultiTextPanel = ({
  title,
  description,
  settingKeys,
  getter,
  setter,
  defaultValue = [],
  parentUid,
  uid: initialBlockUid,
  order,
}: BaseMultiTextPanelProps) => {
  const [values, setValues] = useState<string[]>(
    () => getter(settingKeys) ?? defaultValue,
  );
  const [inputValue, setInputValue] = useState("");
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const blockUidRef = useRef(initialBlockUid);
  const childUidsRef = useRef<string[]>(
    initialBlockUid
      ? getShallowTreeByParentUid(initialBlockUid).map(
          (c: { uid: string }) => c.uid,
        )
      : [],
  );

  const ensureParentBlock = useCallback(async (): Promise<
    string | undefined
  > => {
    if (blockUidRef.current) return blockUidRef.current;
    if (parentUid === undefined || order === undefined) return undefined;
    const newUid = window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.createBlock({
      block: { string: title, uid: newUid },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      location: { order, "parent-uid": parentUid },
    });
    blockUidRef.current = newUid;
    return newUid;
  }, [title, parentUid, order]);

  const handleAdd = async () => {
    if (inputValue.trim() && !values.includes(inputValue.trim())) {
      const trimmed = inputValue.trim();
      const newValues = [...values, trimmed];
      setValues(newValues);
      setter(settingKeys, newValues);
      setInputValue("");

      const parent = await ensureParentBlock();
      if (parent) {
        const valueUid = window.roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createBlock({
          block: { string: trimmed, uid: valueUid },
          location: {
            order: childUidsRef.current.length,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "parent-uid": parent,
          },
        });
        childUidsRef.current = [...childUidsRef.current, valueUid];
      }
    }
  };

  const handleRemove = (index: number) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const newValues = values.filter((_, i) => i !== index);
    setValues(newValues);
    setter(settingKeys, newValues);

    if (hasBlockSync) {
      const removedUid = childUidsRef.current[index];
      if (removedUid) {
        void window.roamAlphaAPI.deleteBlock({ block: { uid: removedUid } });
      }
      childUidsRef.current = childUidsRef.current.filter(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        (_, i) => i !== index,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
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
          placeholder="Add new item"
          className="flex-grow"
        />
        <Button
          icon="plus"
          onClick={() => void handleAdd()}
          disabled={!inputValue.trim()}
        />
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

type TextWrapperProps = Omit<BaseTextPanelProps, "getter" | "setter">;
type FlagWrapperProps = Omit<BaseFlagPanelProps, "getter" | "setter">;
type NumberWrapperProps = Omit<BaseNumberPanelProps, "getter" | "setter">;
type SelectWrapperProps = Omit<BaseSelectPanelProps, "getter" | "setter">;
type MultiTextWrapperProps = Omit<BaseMultiTextPanelProps, "getter" | "setter">;

const featureFlagGetter: FlagGetter = (keys) => {
  const key = keys[0];
  if (!key) return undefined;
  return getFeatureFlag(key as keyof FeatureFlags);
};

const featureFlagSetter: FlagSetter = (keys, value) => {
  const key = keys[0];
  if (!key) return;
  setFeatureFlag(key as keyof FeatureFlags, value);
};

type Getter<T> = (keys: string[]) => T | undefined;
type Setter<T> = (keys: string[], value: T) => void;
type Accessors<T> = { getter: Getter<T>; setter: Setter<T> };

const createAccessors = <T,>(
  getFn: <U>(keys: string[]) => U | undefined,
  setFn: (keys: string[], value: T) => void,
): Accessors<T> => ({
  getter: (keys) => getFn<T>(keys),
  setter: setFn,
});

const globalAccessors = {
  text: createAccessors<string>(getGlobalSetting, setGlobalSetting),
  flag: createAccessors<boolean>(getGlobalSetting, setGlobalSetting),
  number: createAccessors<number>(getGlobalSetting, setGlobalSetting),
  multiText: createAccessors<string[]>(getGlobalSetting, setGlobalSetting),
};

const personalAccessors = {
  text: createAccessors<string>(getPersonalSetting, setPersonalSetting),
  flag: createAccessors<boolean>(getPersonalSetting, setPersonalSetting),
  number: createAccessors<number>(getPersonalSetting, setPersonalSetting),
  multiText: createAccessors<string[]>(getPersonalSetting, setPersonalSetting),
};

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
}) => {
  const handleBeforeChange:
    | ((checked: boolean) => Promise<boolean>)
    | undefined = onBeforeEnable
    ? async (checked) => {
        if (checked) {
          return onBeforeEnable();
        }
        return true;
      }
    : undefined;

  return (
    <BaseFlagPanel
      title={title}
      description={description}
      settingKeys={[featureKey as string]}
      getter={featureFlagGetter}
      setter={featureFlagSetter}
      onBeforeChange={handleBeforeChange}
      onChange={onAfterChange}
    />
  );
};

export const GlobalTextPanel = (props: TextWrapperProps) => (
  <BaseTextPanel {...props} {...globalAccessors.text} />
);

export const GlobalFlagPanel = (props: FlagWrapperProps) => (
  <BaseFlagPanel {...props} {...globalAccessors.flag} />
);

export const GlobalNumberPanel = (props: NumberWrapperProps) => (
  <BaseNumberPanel {...props} {...globalAccessors.number} />
);

export const GlobalSelectPanel = (props: SelectWrapperProps) => (
  <BaseSelectPanel {...props} {...globalAccessors.text} />
);

export const GlobalMultiTextPanel = (props: MultiTextWrapperProps) => (
  <BaseMultiTextPanel {...props} {...globalAccessors.multiText} />
);

export const PersonalTextPanel = (props: TextWrapperProps) => (
  <BaseTextPanel {...props} {...personalAccessors.text} />
);

export const PersonalFlagPanel = (props: FlagWrapperProps) => (
  <BaseFlagPanel {...props} {...personalAccessors.flag} />
);

export const PersonalNumberPanel = (props: NumberWrapperProps) => (
  <BaseNumberPanel {...props} {...personalAccessors.number} />
);

export const PersonalSelectPanel = (props: SelectWrapperProps) => (
  <BaseSelectPanel {...props} {...personalAccessors.text} />
);

export const PersonalMultiTextPanel = (props: MultiTextWrapperProps) => (
  <BaseMultiTextPanel {...props} {...personalAccessors.multiText} />
);
