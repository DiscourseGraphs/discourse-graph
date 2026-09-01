import React, {
  type ChangeEvent,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  Checkbox,
  InputGroup,
  Label,
  NumericInput,
  HTMLSelect,
  Button,
  Tag,
  TextArea,
} from "@blueprintjs/core";
import Description from "~/components/settings/SettingsDescription";
import { settingAnchor } from "~/components/settings/utils/settingAnchor";
import useSingleChildValue from "roamjs-components/components/ConfigPanels/useSingleChildValue";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  getFeatureFlag,
  getDiscourseNodeSetting,
  setGlobalSetting,
  setPersonalSetting,
  setFeatureFlag,
  setDiscourseNodeSetting,
} from "~/components/settings/utils/accessors";
import type { FeatureFlags } from "../utils/zodSchema";
import type { json } from "~/utils/getBlockProps";
import {
  addPendingSettingWrite,
  removePendingSettingWrite,
} from "~/utils/pendingSettingWrites";

type RoamBlockSyncProps = {
  parentUid?: string;
  uid?: string;
  order?: number;
  /**
   * Text of the legacy block this panel mirrors into. Defaults to `title`.
   * Set it when the visible title must differ from the exact text that
   * discourseConfigRef.ts and friends look the block up by.
   */
  blockKey?: string;
};

type TextSetter = (keys: string[], value: string) => void;

type FlagSetter = (keys: string[], value: boolean) => void;

type NumberSetter = (keys: string[], value: number) => void;

type MultiTextSetter = (keys: string[], value: string[]) => void;
type BaseTextPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: TextSetter;
  initialValue: string;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
} & RoamBlockSyncProps;

type BaseFlagPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: FlagSetter;
  initialValue: boolean;
  value?: boolean;
  disabled?: boolean;
  onBeforeChange?: (checked: boolean) => Promise<boolean>;
  onChange?: (checked: boolean) => void;
} & RoamBlockSyncProps;

type BaseNumberPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: NumberSetter;
  initialValue: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
} & RoamBlockSyncProps;

type BaseSelectPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: TextSetter;
  options: string[];
  initialValue: string;
} & RoamBlockSyncProps;

type BaseMultiTextPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: MultiTextSetter;
  initialValue: string[];
  onChange?: (values: string[]) => void;
} & RoamBlockSyncProps;

const SettingTitle = ({
  title,
  description,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
}) => (
  <>
    {title}
    {description ? <Description description={description} /> : null}
  </>
);

const DEBOUNCE_MS = 250;
// Lets a fire-and-forget Roam block write land before refreshConfigTree re-reads it.
const REFRESH_DELAY_MS = 100;

type DeferredWrite = {
  schedule: (commit: () => void, delayMs: number) => void;
};

// Keeps the timer and the registry entry for a panel in step: scheduling a new
// value replaces any pending one, and committing (by timer, by flush, or by
// unmount) runs the write exactly once. Unmount commits rather than cancels --
// navigating away or closing a dialog straight after an edit used to discard it.
const useDeferredWrite = (): DeferredWrite => {
  const timeoutRef = useRef(0);
  const commitRef = useRef<(() => void) | null>(null);

  const forget = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    if (commitRef.current) {
      removePendingSettingWrite(commitRef.current);
      commitRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (commit: () => void, delayMs: number) => {
      forget();
      const runOnce = () => {
        forget();
        commit();
      };
      commitRef.current = runOnce;
      addPendingSettingWrite(runOnce);
      timeoutRef.current = window.setTimeout(runOnce, delayMs);
    },
    [forget],
  );

  useEffect(() => () => commitRef.current?.(), []);

  return { schedule };
};

const BaseTextPanel = ({
  title,
  description,
  settingKeys,
  setter,
  initialValue,
  placeholder,
  multiline,
  error,
  disabled,
  onChange,
  parentUid,
  uid,
  order,
  blockKey,
}: BaseTextPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? "");
  const errorRef = useRef(error);
  errorRef.current = error;
  const { schedule } = useDeferredWrite();
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title: blockKey ?? title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? "",
    transform: (s: string) => s,
    toStr: (s: string) => s,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);

    schedule(() => {
      if (errorRef.current) return;
      syncToBlock?.(newValue);
      setter(settingKeys, newValue);
      // Kept off the committed write so the block-prop value, which is what
      // readers use, is never held back waiting on the tree re-read.
      window.setTimeout(refreshConfigTree, REFRESH_DELAY_MS);
    }, DEBOUNCE_MS);
  };

  return (
    <div className="flex flex-col" {...settingAnchor(settingKeys)}>
      <Label>
        <SettingTitle title={title} description={description} />
        {multiline ? (
          <TextArea
            value={value}
            onChange={handleChange}
            placeholder={placeholder || initialValue}
            className="w-full"
            style={{ minHeight: 80, resize: "vertical" }}
            disabled={disabled}
          />
        ) : (
          <InputGroup
            value={value}
            onChange={handleChange}
            placeholder={placeholder || initialValue}
            disabled={disabled}
          />
        )}
      </Label>
      {error && (
        <div className="mt-1 text-sm font-medium text-red-600">{error}</div>
      )}
    </div>
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
  blockKey,
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
        await window.roamAlphaAPI.data.block.create({
          block: { string: blockKey ?? title, uid: newUid },
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
    [blockKey, title, parentUid, order],
  );

  const handleChange = async (e: React.FormEvent<HTMLInputElement>) => {
    const { checked } = e.target as HTMLInputElement;

    if (onBeforeChange) {
      const shouldProceed = await onBeforeChange(checked);
      if (!shouldProceed) return;
    }

    setInternalValue(checked);
    await syncFlagToBlock(checked);
    refreshConfigTree();
    setter(settingKeys, checked);
    setTimeout(() => onChange?.(checked), 100);
  };

  return (
    <div {...settingAnchor(settingKeys)}>
      <Checkbox
        checked={value ?? internalValue}
        onChange={(e) => void handleChange(e)}
        disabled={disabled}
        labelElement={<SettingTitle title={title} description={description} />}
      />
    </div>
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
  blockKey,
}: BaseNumberPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? 0);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title: blockKey ?? title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? 0,
    transform: (s: string) => parseInt(s, 10),
    toStr: (v: number) => `${v}`,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;
  const { schedule } = useDeferredWrite();

  const handleChange = (valueAsNumber: number) => {
    if (Number.isNaN(valueAsNumber)) return;
    setValue(valueAsNumber);
    syncToBlock?.(valueAsNumber);
    schedule(() => {
      setter(settingKeys, valueAsNumber);
      refreshConfigTree();
      onChange?.(valueAsNumber);
    }, REFRESH_DELAY_MS);
  };

  return (
    <Label {...settingAnchor(settingKeys)}>
      <SettingTitle title={title} description={description} />
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
  blockKey,
}: BaseSelectPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? options[0]);
  const hasBlockSync = parentUid !== undefined && order !== undefined;
  const { onChange: rawSyncToBlock } = useSingleChildValue({
    title: blockKey ?? title,
    parentUid: parentUid ?? "",
    order: order ?? 0,
    uid,
    defaultValue: initialValue ?? options[0] ?? "",
    transform: (s: string) => s,
    toStr: (s: string) => s,
  });
  const syncToBlock = hasBlockSync ? rawSyncToBlock : undefined;
  const { schedule } = useDeferredWrite();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    syncToBlock?.(newValue);
    schedule(() => {
      setter(settingKeys, newValue);
      refreshConfigTree();
    }, REFRESH_DELAY_MS);
  };

  return (
    <Label {...settingAnchor(settingKeys)}>
      <SettingTitle title={title} description={description} />
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
  blockKey,
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
      block: { string: blockKey ?? title, uid: newUid },
      location: { order, "parent-uid": parentUid },
    });
    blockUidRef.current = newUid;
    return newUid;
  }, [blockKey, title, parentUid, order]);

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
            "parent-uid": parent,
          },
        });
        childUidsRef.current = [...childUidsRef.current, valueUid];
        refreshConfigTree();
      }
    }
  };

  const handleRemove = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    setValues(newValues);
    onChange?.(newValues);

    if (hasBlockSync) {
      const removedUid = childUidsRef.current[index];
      if (removedUid) {
        void window.roamAlphaAPI.deleteBlock({ block: { uid: removedUid } });
      }
      childUidsRef.current = childUidsRef.current.filter((_, i) => i !== index);
      refreshConfigTree();
    }
    setter(settingKeys, newValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
    }
  };

  return (
    <Label {...settingAnchor(settingKeys)}>
      <SettingTitle title={title} description={description} />
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

type TextWrapperProps = Omit<BaseTextPanelProps, "setter"> & {
  setter?: TextSetter;
};
type FlagWrapperProps = Omit<BaseFlagPanelProps, "setter">;
type NumberWrapperProps = Omit<BaseNumberPanelProps, "setter"> & {
  setter?: NumberSetter;
};
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
  value,
  disabled,
  onBeforeEnable,
  onAfterChange,
  parentUid,
  uid,
  order,
  blockKey,
}: {
  title: string;
  description: React.ReactNode;
  featureKey: keyof FeatureFlags;
  initialValue?: boolean;
  value?: boolean;
  disabled?: boolean;
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
      blockKey={blockKey}
      description={description}
      settingKeys={[featureKey as string]}
      setter={featureFlagSetter}
      initialValue={initialValue ?? getFeatureFlag(featureKey)}
      value={value}
      disabled={disabled}
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

export const PersonalTextPanel = ({ setter, ...props }: TextWrapperProps) => (
  <BaseTextPanel {...props} setter={setter ?? personalAccessors.text.setter} />
);

export const PersonalFlagPanel = (props: FlagWrapperProps) => (
  <BaseFlagPanel {...props} {...personalAccessors.flag} />
);

export const PersonalNumberPanel = ({
  setter,
  ...props
}: NumberWrapperProps) => (
  <BaseNumberPanel
    {...props}
    setter={setter ?? personalAccessors.number.setter}
  />
);

export const PersonalSelectPanel = (props: SelectWrapperProps) => (
  <BaseSelectPanel {...props} {...personalAccessors.text} />
);

export const PersonalMultiTextPanel = (props: MultiTextWrapperProps) => (
  <BaseMultiTextPanel {...props} {...personalAccessors.multiText} />
);

const createDiscourseNodeSetter =
  (nodeType: string) =>
  (keys: string[], value: json): void =>
    setDiscourseNodeSetting(nodeType, keys, value);

export type DiscourseNodeBaseProps = {
  nodeType: string;
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
};

export const DiscourseNodeTextPanel = ({
  nodeType,
  ...props
}: DiscourseNodeBaseProps &
  RoamBlockSyncProps & {
    initialValue?: string;
    placeholder?: string;
    multiline?: boolean;
    error?: string;
    onChange?: (value: string) => void;
  }) => (
  <BaseTextPanel
    {...props}
    initialValue={
      getDiscourseNodeSetting<string>(nodeType, props.settingKeys) ??
      props.initialValue ??
      ""
    }
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeFlagPanel = ({
  nodeType,
  ...props
}: DiscourseNodeBaseProps &
  RoamBlockSyncProps & {
    initialValue?: boolean;
    disabled?: boolean;
    onBeforeChange?: (checked: boolean) => Promise<boolean>;
    onChange?: (checked: boolean) => void;
  }) => (
  <BaseFlagPanel
    {...props}
    initialValue={
      getDiscourseNodeSetting<boolean>(nodeType, props.settingKeys) ??
      props.initialValue ??
      false
    }
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeSelectPanel = ({
  nodeType,
  ...props
}: DiscourseNodeBaseProps &
  RoamBlockSyncProps & { options: string[]; initialValue?: string }) => (
  <BaseSelectPanel
    {...props}
    initialValue={
      getDiscourseNodeSetting<string>(nodeType, props.settingKeys) ??
      props.initialValue ??
      props.options[0] ??
      ""
    }
    setter={createDiscourseNodeSetter(nodeType)}
  />
);

export const DiscourseNodeNumberPanel = ({
  nodeType,
  ...props
}: DiscourseNodeBaseProps &
  RoamBlockSyncProps & {
    initialValue?: number;
    min?: number;
    max?: number;
  }) => (
  <BaseNumberPanel
    {...props}
    initialValue={
      getDiscourseNodeSetting<number>(nodeType, props.settingKeys) ??
      props.initialValue ??
      0
    }
    setter={createDiscourseNodeSetter(nodeType)}
  />
);
