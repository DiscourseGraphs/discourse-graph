import React from "react";
import { Button } from "@blueprintjs/core";

/**
 * Trailing control for a setting whose value is edited on its own page. Purely
 * presentational — the caller owns navigation, so this stays usable before the
 * settings nav primitive lands (ENG-2186).
 */
const SettingDrillDownSummary = ({
  summary,
  onClick,
  disabled,
}: {
  /**
   * Current value, so the row is readable without drilling in. Where the target
   * has no single value — a list, a template — an action label reads better.
   */
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
