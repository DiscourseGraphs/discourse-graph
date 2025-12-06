import React, { useMemo } from "react";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";

const DiscourseGraphHome = () => {
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

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
      <FlagPanel
        title="(BETA) Left Sidebar"
        description="Whether or not to enable the left sidebar."
        order={2}
        uid={settings.leftSidebarEnabled.uid}
        parentUid={settings.settingsUid}
        value={settings.leftSidebarEnabled.value || false}
      />
    </div>
  );
};

export default DiscourseGraphHome;
