import React, { useMemo, useState } from "react";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { Alert, Intent } from "@blueprintjs/core";
import {
  GlobalTextPanel,
  FeatureFlagPanel,
} from "./components/BlockPropSettingPanels";

const DiscourseGraphHome = () => {
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-1">
      {/* TODO: Titles kept as legacy casing to match readers in discourseConfigRef.ts and initializeObserversAndListeners.ts.
          Update titles to Sentence case once read side is migrated to block props. */}
      <GlobalTextPanel
        title="trigger"
        description="The trigger to create the node menu."
        settingKeys={["Trigger"]}
        initialValue={settings.trigger.value || "\\"}
        order={0}
        uid={settings.trigger.uid}
        parentUid={settings.settingsUid}
      />
      <GlobalTextPanel
        title="Canvas Page Format"
        description="The page format for canvas pages"
        settingKeys={["Canvas page format"]}
        initialValue={
          settings.canvasPageFormat.value || DEFAULT_CANVAS_PAGE_FORMAT
        }
        order={1}
        uid={settings.canvasPageFormat.uid}
        parentUid={settings.settingsUid}
      />
      <FeatureFlagPanel
        title="(BETA) Left Sidebar"
        description="Whether or not to enable the left sidebar."
        initialValue={settings.leftSidebarEnabled.value}
        featureKey="Enable left sidebar"
        order={2}
        uid={settings.leftSidebarEnabled.uid}
        parentUid={settings.settingsUid}
        onAfterChange={(checked: boolean) => {
          if (checked) {
            setIsAlertOpen(true);
          }
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
