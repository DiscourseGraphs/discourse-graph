import React, { useMemo, useState } from "react";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { Alert, Intent } from "@blueprintjs/core";
import { BlockPropFeatureFlagPanel } from "./BlockPropFeatureFlagPanel";

const DiscourseGraphHome = () => {
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  const [isAlertOpen, setIsAlertOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-1">
      <TextPanel
        title="trigger"
        description="The trigger to create the node menu."
        order={0}
        uid={settings.trigger.uid}
        parentUid={settings.settingsUid}
        value={settings.trigger.value}
      />
      <TextPanel
        title="Canvas Page Format"
        description="The page format for canvas pages"
        order={1}
        uid={settings.canvasPageFormat.uid}
        parentUid={settings.settingsUid}
        value={settings.canvasPageFormat.value}
        defaultValue={DEFAULT_CANVAS_PAGE_FORMAT}
      />
      <BlockPropFeatureFlagPanel
        title="(BETA) Left Sidebar"
        description="Whether or not to enable the left sidebar."
        featureKey="Enable Left Sidebar"
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
