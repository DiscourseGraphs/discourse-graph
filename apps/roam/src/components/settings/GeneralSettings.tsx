import React, { useMemo, useState } from "react";
import discourseConfigRef from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { Alert, Intent } from "@blueprintjs/core";
import {
  GlobalTextPanel,
  FeatureFlagPanel,
} from "./components/BlockPropSettingPanels";
import { GLOBAL_KEYS } from "~/components/settings/utils/settingKeys";
import { bulkReadSettings, isNewSettingsStoreEnabled } from "./utils/accessors";
import posthog from "posthog-js";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  getUidAndBooleanSetting,
  getUidAndStringSetting,
} from "~/utils/getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";

const DiscourseGraphHome = () => {
  const [snapshot] = useState(() => bulkReadSettings());
  const globalSettings = snapshot.globalSettings;
  const settings = useMemo(() => {
    refreshConfigTree();
    const tree = discourseConfigRef.tree;
    return {
      settingsUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
      triggerUid: getUidAndStringSetting({ tree, text: "trigger" }).uid,
      canvasPageFormatUid: getUidAndStringSetting({
        tree,
        text: "Canvas Page Format",
      }).uid,
      leftSidebarEnabledUid: getUidAndBooleanSetting({
        tree,
        text: "(BETA) Left Sidebar",
      }).uid,
    };
  }, []);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-1">
      {/* TODO: Titles kept as legacy casing to match readers in discourseConfigRef.ts and initializeObserversAndListeners.ts.
          Update titles to Sentence case once read side is migrated to block props. */}
      <GlobalTextPanel
        title="trigger"
        description="The trigger to create the node menu."
        settingKeys={[GLOBAL_KEYS.trigger]}
        initialValue={globalSettings[GLOBAL_KEYS.trigger]}
        order={0}
        uid={settings.triggerUid}
        parentUid={settings.settingsUid}
      />
      <GlobalTextPanel
        title="Canvas Page Format"
        description="The page format for canvas pages"
        settingKeys={[GLOBAL_KEYS.canvasPageFormat]}
        initialValue={globalSettings[GLOBAL_KEYS.canvasPageFormat]}
        order={1}
        uid={settings.canvasPageFormatUid}
        parentUid={settings.settingsUid}
      />
      <FeatureFlagPanel
        title="(BETA) Left Sidebar"
        description="Whether or not to enable the left sidebar."
        featureKey="Enable left sidebar"
        order={2}
        uid={settings.leftSidebarEnabledUid}
        parentUid={settings.settingsUid}
        onAfterChange={(checked: boolean) => {
          if (checked && !isNewSettingsStoreEnabled()) {
            setIsAlertOpen(true);
          }
          posthog.capture("General Settings: Left Sidebar Toggled", {
            enabled: checked,
          });
        }}
      />
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

export default DiscourseGraphHome;
