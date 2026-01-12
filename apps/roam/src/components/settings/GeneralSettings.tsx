import React from "react";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { FeatureFlagPanel, GlobalTextPanel } from "./components/BlockPropSettingPanels";

const DiscourseGraphHome = () => {
  return (
    <div className="flex flex-col gap-4 p-1">
      <GlobalTextPanel
        title="trigger"
        description="The trigger to create the node menu."
        settingKeys={["Trigger"]}
        defaultValue="\\"
      />
      <GlobalTextPanel
        title="Canvas Page Format"
        description="The page format for canvas pages"
        settingKeys={["Canvas Page Format"]}
        defaultValue={DEFAULT_CANVAS_PAGE_FORMAT}
      />
      <FeatureFlagPanel
        title="(BETA) Enable Left Sidebar"
        description="Whether or not to enable the left sidebar."
        featureKey="Enable Left Sidebar"
      />
    </div>
  );
};

export default DiscourseGraphHome;
