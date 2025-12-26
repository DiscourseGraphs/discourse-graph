import React, { useMemo, useState } from "react";
import { Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import idToTitle from "roamjs-components/util/idToTitle";
import {
  getFeatureFlag,
  getGlobalSetting,
  getPersonalSetting,
  setFeatureFlag,
  setGlobalSetting,
  setPersonalSetting,
} from "~/components/settings/block-prop/utils/accessors";
import { type FeatureFlags } from "~/components/settings/block-prop/utils/zodSchema";
import z from "zod";
import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";

type FeatureFlagPath = [
  typeof TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags,
  keyof FeatureFlags,
];

type GlobalSettingPath = [typeof TOP_LEVEL_BLOCK_PROP_KEYS.global, ...string[]];

type PersonalSettingPath = [string, ...string[]];

type FlagPath = FeatureFlagPath | GlobalSettingPath | PersonalSettingPath;

type Props = {
  title: string;
  description: string;
  disabled?: boolean;
  flag: FlagPath;
};

const getAdapter = (flag: FlagPath) => {
  const [root, ...rest] = flag;

  if (root === TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags) {
    const key = rest[0] as keyof FeatureFlags;
    return {
      getValue: () => getFeatureFlag(key),
      setValue: (checked: boolean) => setFeatureFlag(key, checked),
    };
  }

  if (root === TOP_LEVEL_BLOCK_PROP_KEYS.global) {
    return {
      getValue: () => {
        const current = getGlobalSetting(rest);
        const parsed = z.boolean().safeParse(current);
        return parsed.success ? parsed.data : false;
      },
      setValue: (checked: boolean) => setGlobalSetting(rest, checked),
    };
  }

  if (root === getPersonalSettingsKey()) {
    return {
      getValue: () => {
        const current = getPersonalSetting(rest);
        const parsed = z.boolean().safeParse(current);
        return parsed.success ? parsed.data : false;
      },
      setValue: (checked: boolean) => setPersonalSetting(rest, checked),
    };
  }

  return {
    getValue: () => false,
    setValue: (checked: boolean) => {
      console.warn(`Unknown flag root: ${root} - received value: ${checked}`);
    },
  };
};

export const FlagPanel = ({ title, description, disabled, flag }: Props) => {
  const adapter = useMemo(() => getAdapter(flag), [flag]);
  const [value, setLocalValue] = useState<boolean>(() => adapter.getValue());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    adapter.setValue(checked);
    setLocalValue(checked);
  };

  return (
    <Checkbox
      checked={value}
      disabled={disabled}
      onChange={handleChange}
      labelElement={
        <>
          {idToTitle(title)}
          <Description description={description} />
        </>
      }
    />
  );
};
