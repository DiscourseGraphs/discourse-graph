import { getFeatureFlag, setFeatureFlag } from "../utils/accessors";
import { type FeatureFlags } from "../utils/zodSchema";
import { Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import idToTitle from "roamjs-components/util/idToTitle";
import React, { useState } from "react";

export const BlockPropFeatureFlagPanel = ({
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
  const [value, setValue] = useState(() => getFeatureFlag(featureKey));

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;

    if (checked && onBeforeEnable) {
      const shouldProceed = await onBeforeEnable();
      if (!shouldProceed) return;
    }

    setFeatureFlag(featureKey, checked);
    setValue(checked);
    onAfterChange?.(checked);
  };

  return (
    <Checkbox
      checked={value}
      onChange={(e) => void handleChange(e)}
      labelElement={
        <>
          {idToTitle(title)}
          <Description description={description} />
        </>
      }
    />
  );
};
