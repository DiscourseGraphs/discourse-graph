import { featureFlagEnabled } from "~/utils/featureFlags";
import { type FeatureFlags } from "~/utils/zodSchemaForSettings";
import { Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import idToTitle from "roamjs-components/util/idToTitle";
import React, { useState } from "react";

export const BlockPropFlagPanel = ({
  title,
  description,
  featureKey,
}: {
  title: string;
  description: string;
  featureKey: keyof FeatureFlags;
}) => {
  const [value, setValue] = useState(() =>
    featureFlagEnabled({ key: featureKey }),
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    featureFlagEnabled({ key: featureKey, value: checked });
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
