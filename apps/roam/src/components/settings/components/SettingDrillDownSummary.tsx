import React from "react";
import { Button } from "@blueprintjs/core";

const SettingDrillDownSummary = ({
  summary,
  onClick,
  disabled,
}: {
  /** Current value, or an action label where there is no single value. */
  summary: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}): React.ReactElement => (
  <Button
    minimal
    rightIcon="chevron-right"
    onClick={onClick}
    disabled={disabled}
    className="max-w-xs"
  >
    <span className="truncate text-gray-500">{summary}</span>
  </Button>
);

export default SettingDrillDownSummary;
