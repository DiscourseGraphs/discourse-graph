import React, { useMemo } from "react";
import { OnloadArgs } from "roamjs-components/types";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import { SETTING, toggleGitHubSync } from "~/components/GitHubSync";

const DiscourseGraphHome = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
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
        title={SETTING}
        description="Sync select pages with GitHub Issues"
        parentUid={settings.settingsUid}
        order={2}
        uid={settings.githubSync.uid}
        value={settings.githubSync.value}
        options={{
          onChange: (checked) => toggleGitHubSync(checked, onloadArgs),
        }}
      />
    </div>
  );
};

export default DiscourseGraphHome;
