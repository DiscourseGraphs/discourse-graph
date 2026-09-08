import React from "react";
import { Button, Intent, Label } from "@blueprintjs/core";
import Description from "~/components/settings/SettingsDescription";

const SettingsDrillDownRow = ({
  title,
  description,
  buttonText,
  onClick,
}: {
  title: string;
  description: React.ReactNode;
  buttonText: string;
  onClick: () => void;
}): JSX.Element => (
  <Label>
    {title}
    <Description description={description} />
    <div>
      <Button
        outlined
        intent={Intent.PRIMARY}
        rightIcon="chevron-right"
        text={buttonText}
        onClick={onClick}
      />
    </div>
  </Label>
);

export default SettingsDrillDownRow;
