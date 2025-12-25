import {
  getFeatureFlag,
  setFeatureFlag,
} from "~/utils/Settings/accessors";
import { type FeatureFlags } from "~/utils/Settings/zodSchema";
import { Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import idToTitle from "roamjs-components/util/idToTitle";
import React, { useState } from "react";

export const BlockPropFeatureFlagPanel = ({
  title,
  description,
  featureKey,
}: {
  title: string;
  description: string;
  featureKey: keyof FeatureFlags;
}) => {
  const [value, setValue] = useState(() => getFeatureFlag(featureKey));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFeatureFlag(featureKey, checked);
    setValue(checked);
  };

  return (
    <Checkbox
      checked={value}
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
