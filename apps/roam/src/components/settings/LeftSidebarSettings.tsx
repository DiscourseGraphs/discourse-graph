import React, { useState } from "react";
import { Alert, Intent } from "@blueprintjs/core";
import posthog from "posthog-js";
import { LeftSidebarPersonalSections } from "./LeftSidebarPersonalSettings";
import { LeftSidebarGlobalSections } from "./LeftSidebarGlobalSettings";
import { FeatureFlagPanel } from "./components/BlockPropSettingPanels";
import { SettingsSectionHeading } from "./components/SettingsHeadings";
import { type SettingsSnapshot } from "./utils/accessors";
import { useLegacyConfigBlocks } from "./utils/useLegacyConfigBlocks";

/** The enable toggle lives here so the tab stays reachable when it is off. */
const LeftSidebarSettings = ({
  enabled,
  globalSettings,
  personalSettings,
  featureFlags,
  expandedSectionUid,
}: {
  enabled: boolean;
  globalSettings: SettingsSnapshot["globalSettings"];
  personalSettings: SettingsSnapshot["personalSettings"];
  featureFlags: SettingsSnapshot["featureFlags"];
  expandedSectionUid?: string;
}) => {
  const legacyBlocks = useLegacyConfigBlocks();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6 p-1">
      <FeatureFlagPanel
        title="Enable left sidebar"
        description="Whether or not to enable the left sidebar."
        featureKey="Enable left sidebar"
        initialValue={featureFlags["Enable left sidebar"]}
        {...legacyBlocks.leftSidebarFlag}
        onAfterChange={(checked: boolean) => {
          if (checked && !featureFlags["Use new settings store"]) {
            setIsAlertOpen(true);
          }
          posthog.capture("General Settings: Left Sidebar Toggled", {
            enabled: checked,
          });
        }}
      />
      {enabled && (
        <>
          <div className="flex flex-col gap-2">
            <SettingsSectionHeading>Shared sections</SettingsSectionHeading>
            <LeftSidebarGlobalSections globalSettings={globalSettings} />
          </div>
          <div className="flex flex-col gap-2">
            <SettingsSectionHeading>Your sections</SettingsSectionHeading>
            <LeftSidebarPersonalSections
              personalSettings={personalSettings}
              expandedSectionUid={expandedSectionUid}
            />
          </div>
        </>
      )}
      <Alert
        isOpen={isAlertOpen}
        onConfirm={() => window.location.reload()}
        onCancel={() => setIsAlertOpen(false)}
        confirmButtonText="Reload Graph"
        cancelButtonText="Later"
        intent={Intent.PRIMARY}
      >
        <p>Enabling the Left Sidebar requires a graph reload to take effect.</p>
        <p>Would you like to reload now?</p>
      </Alert>
    </div>
  );
};

export default LeftSidebarSettings;
