import React, { useState, useMemo } from "react";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import { OnloadArgs } from "roamjs-components/types";
import { Label, InputGroup } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import refreshConfigTree from "~/utils/refreshConfigTree";

const DiscourseGraphHome = () => {
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-1">
      <div>
        <FlagPanel
          title="disable sidebar open"
          description="Disable opening new nodes in the sidebar when created"
          order={1}
          uid={settings.disableSidebarOpen.uid}
          parentUid={settings.settingsUid}
          value={settings.disableSidebarOpen.value || false}
        />
        <FlagPanel
          title="preview"
          description="Whether or not to display page previews when hovering over page refs"
          order={2}
          uid={settings.preview.uid}
          parentUid={settings.settingsUid}
          value={settings.preview.value || false}
        />
        <FlagPanel
          title="overlay"
          // description="Whether or not to overlay discourse context information over node references"
          description="Currently disabled. Being reworked."
          order={3}
          uid={settings.overlay.uid}
          parentUid={settings.grammarUid}
          value={settings.overlay.value || false}
          disabled={true}
        />
      </div>
      <TextPanel
        title="trigger"
        description="The trigger to create the node menu."
        order={0}
        uid={settings.trigger.uid}
        parentUid={settings.settingsUid}
        value={settings.trigger.value || ""}
      />
    </div>
  );
};

export default DiscourseGraphHome;
