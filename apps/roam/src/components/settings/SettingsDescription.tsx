import React from "react";

/**
 * Renders a setting's description inline. It used to be a hover popover, which
 * dismissed on mouseleave before a doc link inside it could be clicked
 * (ENG-2080). Rows built on `SettingItemRow` get this styling from the row
 * itself; this component remains for rows not yet migrated (ENG-2187).
 */
const SettingsDescription = ({
  description,
}: {
  description: React.ReactNode;
}): React.ReactElement => (
  <div className="text-sm font-normal text-gray-500">{description}</div>
);

export default SettingsDescription;
