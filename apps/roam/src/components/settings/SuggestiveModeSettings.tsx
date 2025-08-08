import React, { useMemo } from "react";
import { Button, Intent } from "@blueprintjs/core";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import PageGroupsPanel from "./PageGroupPanel";

const SuggestiveModeSettings = () => {
  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  return (
    <div className="relative flex flex-col gap-4 p-1">
      <div className="mb-2 text-lg font-semibold text-neutral-dark">
        Discourse Suggestions
      </div>
      <div className="mt-4">
        <Button
          icon="cloud-upload"
          text={"Generate & Upload All Node Embeddings"}
          onClick={() => console.log("Not implemented")}
          intent={Intent.PRIMARY}
          style={{ marginTop: "8px" }}
        />
      </div>
      <div className="context-settings">
        <FlagPanel
          title="Include Current Page Relations"
          description="Include relations from pages referenced on the current page"
          order={0}
          uid={settings.suggestiveMode.grabFromReferencedPages.uid}
          parentUid={settings.suggestiveMode.parentUid}
          value={settings.suggestiveMode.grabFromReferencedPages.value}
        />
        <FlagPanel
          title="Include Parent And Child Blocks"
          description="Include relations from parent and child blocks"
          order={1}
          uid={settings.suggestiveMode.grabParentAndChildren.uid}
          parentUid={settings.suggestiveMode.parentUid}
          value={settings.suggestiveMode.grabParentAndChildren.value}
        />
      </div>
      <div className="page-groups-settings">
        <PageGroupsPanel uid={settings.suggestiveMode.pageGroups.uid} />
      </div>
    </div>
  );
};

export default SuggestiveModeSettings;
