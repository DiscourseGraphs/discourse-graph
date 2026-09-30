import React from "react";

/** Inline, not a hover popover: the popover dismissed before its doc links could be
 *  clicked (ENG-2080). Kept for rows not yet on SettingItemRow. */
const SettingsDescription = ({
  description,
}: {
  description: React.ReactNode;
}): React.ReactElement => (
  <div className="text-sm font-normal text-gray-500">{description}</div>
);

export default SettingsDescription;
