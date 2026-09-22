import React from "react";
import { LeftSidebarPersonalSections } from "./LeftSidebarPersonalSettings";
import { LeftSidebarGlobalSections } from "./LeftSidebarGlobalSettings";
import { SettingsSectionHeading } from "./components/SettingsHeadings";
import { type SettingsSnapshot } from "./utils/accessors";

/** The tab is hidden while the feature is off, so these sections never need to
 *  gate themselves; the enable toggle lives on Preferences > General. */
const LeftSidebarSettings = ({
  globalSettings,
  personalSettings,
  expandedSectionUid,
}: {
  globalSettings: SettingsSnapshot["globalSettings"];
  personalSettings: SettingsSnapshot["personalSettings"];
  expandedSectionUid?: string;
}): React.ReactElement => (
  <div className="flex flex-col gap-6 p-1">
    <div className="flex flex-col gap-2">
      <SettingsSectionHeading>Global</SettingsSectionHeading>
      <LeftSidebarGlobalSections globalSettings={globalSettings} />
    </div>
    <div className="flex flex-col gap-2">
      <SettingsSectionHeading>Personal</SettingsSectionHeading>
      <LeftSidebarPersonalSections
        personalSettings={personalSettings}
        expandedSectionUid={expandedSectionUid}
      />
    </div>
  </div>
);

export default LeftSidebarSettings;
