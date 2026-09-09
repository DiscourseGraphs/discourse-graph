import React, {
  type ChangeEvent,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  InputGroup,
  NumericInput,
  HTMLSelect,
  Button,
  Switch,
  Tag,
  TextArea,
} from "@blueprintjs/core";
import SettingItemRow, {
  type SettingScope,
} from "~/components/settings/components/SettingItemRow";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import createBlock from "roamjs-components/writes/createBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import { trackRoamWrite } from "~/utils/setBlockProps";
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
  /** Legacy block text when it must differ from `title`; readers such as
   *  discourseConfigRef.ts match on it exactly. Defaults to `title`. */
  blockKey?: string;
};

type TextSetter = (keys: string[], value: string) => void;

type FlagSetter = (keys: string[], value: boolean) => void;

type NumberSetter = (keys: string[], value: number) => void;

type MultiTextSetter = (keys: string[], value: string[]) => void;

type RowPresentationProps = {
  scope?: SettingScope;
  /** Tighter row for narrow hosts such as the Export dialog. */
  compact?: boolean;
};

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
} & RoamBlockSyncProps &
  RowPresentationProps;

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
} & RoamBlockSyncProps &
  RowPresentationProps;

type BaseNumberPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: NumberSetter;
  initialValue: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
} & RoamBlockSyncProps &
  RowPresentationProps;

type BaseSelectPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: TextSetter;
  options: string[];
  initialValue: string;
} & RoamBlockSyncProps &
  RowPresentationProps;

type BaseMultiTextPanelProps = {
  title: string;
  description: React.ReactNode;
  settingKeys: string[];
  setter: MultiTextSetter;
  initialValue: string[];
  onChange?: (values: string[]) => void;
} & RoamBlockSyncProps &
  RowPresentationProps;

const DEBOUNCE_MS = 250;
const SHORT_DEBOUNCE_MS = 100;

type Commit = () => void | Promise<void>;

type DeferredWrite = {
  schedule: (commit: Commit, delayMs: number) => void;
};

type LegacyBlockSync = (text: string) => Promise<void>;

// The legacy config tree is what readers see while `Use new settings store` is
// off, so a commit must be able to await this write before re-reading the tree.
const useLegacyBlockSync = ({
  title,
  parentUid,
  order,
  uid,
}: {
  title: string;
  parentUid?: string;
  order?: number;
  uid?: string;
}): LegacyBlockSync | undefined => {
  const uidRef = useRef(uid);
  const valueUidRef = useRef(uid ? getFirstChildUidByBlockUid(uid) : "");
  const enabled = parentUid !== undefined && order !== undefined;
  const sync = useCallback(
    async (text: string): Promise<void> => {
      if (valueUidRef.current) {
        await trackRoamWrite(updateBlock({ uid: valueUidRef.current, text }));
        return;
      }
      if (!uidRef.current) {
        uidRef.current = await trackRoamWrite(
          createBlock({
            node: { text: title },
            parentUid: parentUid ?? "",
            order: order ?? 0,
          }),
        );
      }
      valueUidRef.current = await trackRoamWrite(
        createBlock({ node: { text }, parentUid: uidRef.current, order: 0 }),
      );
    },
    [title, parentUid, order],
  );
  return enabled ? sync : undefined;
};

// One timer and one registry entry per panel: a commit runs exactly once, by timer,
// flush, or unmount. Unmount commits rather than cancels.
const useDeferredWrite = (): DeferredWrite => {
  const timeoutRef = useRef(0);
  const commitRef = useRef<(() => Promise<void>) | null>(null);

  const forget = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    if (commitRef.current) {
      removePendingSettingWrite(commitRef.current);
      commitRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (commit: Commit, delayMs: number) => {
      forget();
      const runOnce = async (): Promise<void> => {
        forget();
        await commit();
      };
      commitRef.current = runOnce;
      addPendingSettingWrite(runOnce);
      timeoutRef.current = window.setTimeout(() => void runOnce(), delayMs);
    },
    [forget],
  );

  useEffect(() => () => void commitRef.current?.(), []);

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
  scope,
  compact,
}: BaseTextPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? "");
  const errorRef = useRef(error);
  errorRef.current = error;
  const { schedule } = useDeferredWrite();
  const syncToBlock = useLegacyBlockSync({
    title: blockKey ?? title,
    parentUid,
    order,
    uid,
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);

    schedule(async () => {
      if (errorRef.current) return;
      await syncToBlock?.(newValue);
      setter(settingKeys, newValue);
      refreshConfigTree();
    }, DEBOUNCE_MS);
  };

  return (
    <SettingItemRow
      label={title}
      description={description}
      scope={scope}
      compact={compact}
      settingKeys={settingKeys}
      error={error}
      controlPlacement={multiline ? "below" : "trailing"}
      control={(controlId) =>
        multiline ? (
          <TextArea
            id={controlId}
            value={value}
            onChange={handleChange}
            placeholder={placeholder || initialValue}
            className="w-full"
            style={{ minHeight: 80, resize: "vertical" }}
            disabled={disabled}
          />
        ) : (
          <InputGroup
            id={controlId}
            value={value}
            onChange={handleChange}
            placeholder={placeholder || initialValue}
            disabled={disabled}
            className="w-56"
          />
        )
      }
    />
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
  scope,
  compact,
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
    <SettingItemRow
      label={title}
      description={description}
      scope={scope}
      compact={compact}
      settingKeys={settingKeys}
      control={(controlId) => (
        <Switch
          id={controlId}
          checked={value ?? internalValue}
          onChange={(e) => void handleChange(e)}
          disabled={disabled}
          className="mb-0"
        />
      )}
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
  blockKey,
  scope,
  compact,
}: BaseNumberPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? 0);
  const syncToBlock = useLegacyBlockSync({
    title: blockKey ?? title,
    parentUid,
    order,
    uid,
  });
  const { schedule } = useDeferredWrite();

  const handleChange = (valueAsNumber: number) => {
    if (Number.isNaN(valueAsNumber)) return;
    setValue(valueAsNumber);
    schedule(async () => {
      await syncToBlock?.(`${valueAsNumber}`);
      setter(settingKeys, valueAsNumber);
      refreshConfigTree();
      onChange?.(valueAsNumber);
    }, SHORT_DEBOUNCE_MS);
  };

  return (
    <SettingItemRow
      label={title}
      description={description}
      scope={scope}
      compact={compact}
      settingKeys={settingKeys}
      control={(controlId) => (
        <div className="w-24">
          <NumericInput
            id={controlId}
            value={value}
            onValueChange={handleChange}
            min={min}
            max={max}
            fill
          />
        </div>
      )}
    />
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
  scope,
  compact,
}: BaseSelectPanelProps) => {
  const [value, setValue] = useState(() => initialValue ?? options[0]);
  const syncToBlock = useLegacyBlockSync({
    title: blockKey ?? title,
    parentUid,
    order,
    uid,
  });
  const { schedule } = useDeferredWrite();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    schedule(async () => {
      await syncToBlock?.(newValue);
      setter(settingKeys, newValue);
      refreshConfigTree();
    }, SHORT_DEBOUNCE_MS);
  };

  return (
    <SettingItemRow
      label={title}
      description={description}
      scope={scope}
      compact={compact}
      settingKeys={settingKeys}
      control={(controlId) => (
        <HTMLSelect
          id={controlId}
          value={value}
          onChange={handleChange}
          options={options}
        />
      )}
    />
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
  scope,
  compact,
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
    <SettingItemRow
      label={title}
      description={description}
      scope={scope}
      compact={compact}
      settingKeys={settingKeys}
      controlPlacement="below"
      control={(controlId) => (
        <>
          <div className="flex gap-2">
            <InputGroup
              id={controlId}
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
        </>
      )}
    />
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
  scope = "global",
}: {
  title: string;
  description: React.ReactNode;
  featureKey: keyof FeatureFlags;
  initialValue?: boolean;
  value?: boolean;
  disabled?: boolean;
  onBeforeEnable?: () => Promise<boolean>;
  onAfterChange?: (checked: boolean) => void;
} & RoamBlockSyncProps &
  RowPresentationProps) => {
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
      scope={scope}
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

/** Scope comes from the wrapper because it binds the setter that decides where a value
 *  lands; a call site that overrides `setter` must pass `scope` too. */
export const GlobalTextPanel = ({
  scope = "global",
  ...props
}: TextWrapperProps) => (
  <BaseTextPanel {...props} scope={scope} {...globalAccessors.text} />
);

export const GlobalFlagPanel = ({
  scope = "global",
  ...props
}: FlagWrapperProps) => (
  <BaseFlagPanel {...props} scope={scope} {...globalAccessors.flag} />
);

export const GlobalNumberPanel = ({
  scope = "global",
  ...props
}: NumberWrapperProps) => (
  <BaseNumberPanel {...props} scope={scope} {...globalAccessors.number} />
);

export const GlobalSelectPanel = ({
  scope = "global",
  ...props
}: SelectWrapperProps) => (
  <BaseSelectPanel {...props} scope={scope} {...globalAccessors.text} />
);

export const GlobalMultiTextPanel = ({
  scope = "global",
  ...props
}: MultiTextWrapperProps) => (
  <BaseMultiTextPanel {...props} scope={scope} {...globalAccessors.multiText} />
);

export const PersonalTextPanel = ({
  setter,
  scope = "personal",
  ...props
}: TextWrapperProps) => (
  <BaseTextPanel
    {...props}
    scope={scope}
    setter={setter ?? personalAccessors.text.setter}
  />
);

export const PersonalFlagPanel = ({
  scope = "personal",
  ...props
}: FlagWrapperProps) => (
  <BaseFlagPanel {...props} scope={scope} {...personalAccessors.flag} />
);

export const PersonalNumberPanel = ({
  setter,
  scope = "personal",
  ...props
}: NumberWrapperProps) => (
  <BaseNumberPanel
    {...props}
    scope={scope}
    setter={setter ?? personalAccessors.number.setter}
  />
);

export const PersonalSelectPanel = ({
  scope = "personal",
  ...props
}: SelectWrapperProps) => (
  <BaseSelectPanel {...props} scope={scope} {...personalAccessors.text} />
);

export const PersonalMultiTextPanel = ({
  scope = "personal",
  ...props
}: MultiTextWrapperProps) => (
  <BaseMultiTextPanel
    {...props}
    scope={scope}
    {...personalAccessors.multiText}
  />
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
    scope="global"
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
    scope="global"
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
    scope="global"
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
    scope="global"
    initialValue={
      getDiscourseNodeSetting<number>(nodeType, props.settingKeys) ??
      props.initialValue ??
      0
    }
    setter={createDiscourseNodeSetter(nodeType)}
  />
);
