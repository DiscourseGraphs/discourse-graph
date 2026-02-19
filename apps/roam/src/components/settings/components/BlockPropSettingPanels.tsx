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
import useSingleChildValue from "roamjs-components/components/ConfigPanels/useSingleChildValue";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import {
  setGlobalSetting,
  setPersonalSetting,
  setFeatureFlag,
} from "~/components/settings/utils/accessors";
import type { FeatureFlags } from "~/components/settings/utils/zodSchema";

type RoamBlockSyncProps = {
  parentUid?: string;
  uid?: string;
  order?: number;
};

type TextSetter = (keys: string[], value: string) => void;

type FlagSetter = (keys: string[], value: boolean) => void;

type NumberSetter = (keys: string[], value: number) => void;

type MultiTextSetter = (keys: string[], value: string[]) => void;

type BaseTextPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  setter: TextSetter;
  initialValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
} & RoamBlockSyncProps;

type BaseFlagPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  setter: FlagSetter;
  initialValue?: boolean;
  value?: boolean;
  disabled?: boolean;
  onBeforeChange?: (checked: boolean) => Promise<boolean>;
  onChange?: (checked: boolean) => void;
} & RoamBlockSyncProps;

type BaseNumberPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  setter: NumberSetter;
  initialValue?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
} & RoamBlockSyncProps;

type BaseSelectPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  setter: TextSetter;
  options: string[];
  initialValue?: string;
} & RoamBlockSyncProps;

type BaseMultiTextPanelProps = {
  title: string;
  description: string;
  settingKeys: string[];
  setter: MultiTextSetter;
  initialValue?: string[];
  onChange?: (values: string[]) => void;
} & RoamBlockSyncProps;

const BaseTextPanel = ({
  title,
  description,
  settingKeys,
  setter,
  initialValue,
  placeholder,
  onChange,
  parentUid,
  uid,
  order,
}: BaseTextPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? "");
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? "",
    transform: (s: string) => s,
    toStr: (s: string) => s,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setter(settingKeys, newValue);
    syncToBlock?.(newValue);
    onChange?.(newValue);
  };

  return (
    <Label>
      {title}
      <Description description={description} />
      <InputGroup
        value={value}
        onChange={handleChange}
        placeholder={placeholder || initialValue}
      />
    </Label>
  );
};

const BaseFlagPanel = ({
  title,
  description,
  settingKeys,
  setter,
  initialValue,
  value,
  disabled = false,
  onBeforeChange,
  onChange,
  parentUid,
  uid: initialBlockUid,
  order,
}: BaseFlagPanelProps) => {
  const [internalValue, setInternalValue] = useState(
    () => initialValue ?? false,
  );
  const blockUidRef = useRef(initialBlockUid);

  const syncFlagToBlock = useCallback(
    async (checked: boolean) => {
      if (parentUid === undefined || order === undefined) return;
      if (checked) {
        if (blockUidRef.current) return;
        const newUid = window.roamAlphaAPI.util.generateUID();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        await window.roamAlphaAPI.data.block.create({
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

    setInternalValue(checked);
    setter(settingKeys, checked);
    await syncFlagToBlock(checked);
    onChange?.(checked);
  };

  return (
    <Checkbox
      checked={value ?? internalValue}
      onChange={(e) => void handleChange(e)}
      disabled={disabled}
      labelElement={
        <>
          {title}
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
  setter,
  initialValue,
  min,
  max,
  onChange,
  parentUid,
  uid,
  order,
}: BaseNumberPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? 0);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? 0,
    transform: (s: string) => parseInt(s, 10),
    toStr: (v: number) => `${v}`,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (valueAsNumber: number) => {
    if (Number.isNaN(valueAsNumber)) return;
    setValue(valueAsNumber);
    setter(settingKeys, valueAsNumber);
    syncToBlock?.(valueAsNumber);
    onChange?.(valueAsNumber);
  };

  return (
    <Label>
      {title}
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
  setter,
  options,
  initialValue,
  parentUid,
  uid,
  order,
}: BaseSelectPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? options[0]);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? options[0] ?? "",
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
      {title}
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
  setter,
  initialValue,
  onChange,
  parentUid,
  uid: initialBlockUid,
  order,
}: BaseMultiTextPanelProps) => {
  const [values, setValues] = useState<string[]>(() => initialValue ?? []);
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
      onChange?.(newValues);

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
    onChange?.(newValues);

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
      {title}
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

type TextWrapperProps = Omit<BaseTextPanelProps, "setter">;
type FlagWrapperProps = Omit<BaseFlagPanelProps, "setter">;
type NumberWrapperProps = Omit<BaseNumberPanelProps, "setter">;
type SelectWrapperProps = Omit<BaseSelectPanelProps, "setter">;
type MultiTextWrapperProps = Omit<BaseMultiTextPanelProps, "setter">;

const featureFlagSetter: FlagSetter = (keys, value) => {
  const key = keys[0];
  if (!key) return;
  setFeatureFlag(key as keyof FeatureFlags, value);
};

type Setter<T> = (keys: string[], value: T) => void;
type Accessors<T> = { setter: Setter<T> };

const createAccessors = <T,>(
  setFn: (keys: string[], value: T) => void,
): Accessors<T> => ({
  setter: setFn,
});

const globalAccessors = {
  text: createAccessors<string>(setGlobalSetting),
  flag: createAccessors<boolean>(setGlobalSetting),
  number: createAccessors<number>(setGlobalSetting),
  multiText: createAccessors<string[]>(setGlobalSetting),
};

const personalAccessors = {
  text: createAccessors<string>(setPersonalSetting),
  flag: createAccessors<boolean>(setPersonalSetting),
  number: createAccessors<number>(setPersonalSetting),
  multiText: createAccessors<string[]>(setPersonalSetting),
};

export const FeatureFlagPanel = ({
  title,
  description,
  featureKey,
  initialValue,
  onBeforeEnable,
  onAfterChange,
  parentUid,
  uid,
  order,
}: {
  title: string;
  description: string;
  featureKey: keyof FeatureFlags;
  initialValue?: boolean;
  onBeforeEnable?: () => Promise<boolean>;
  onAfterChange?: (checked: boolean) => void;
} & RoamBlockSyncProps) => {
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
      setter={featureFlagSetter}
      initialValue={initialValue}
      onBeforeChange={handleBeforeChange}
      onChange={onAfterChange}
      parentUid={parentUid}
      uid={uid}
      order={order}
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
